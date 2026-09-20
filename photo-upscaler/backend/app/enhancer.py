"""Loads the upscaling/face-restoration models once and runs the enhance pipeline.

Models are self-hosted (open-source weights, downloaded on first use):
- Real-ESRGAN (x4plus) for general super-resolution / detail synthesis.
- GFPGAN for face restoration, since faces are what a phone's computational
  photography pipeline spends most of its effort on.

"iPhone-style" output isn't a real target we can measure against - there's no
ground truth for what a scene would have looked like through a different
camera. What we can do is combine sharp upscaling with the kind of tone
curve, local contrast and saturation punch phone camera pipelines apply, so
the result reads like modern computational photography rather than a
flat resize.
"""

from __future__ import annotations

import threading
from pathlib import Path

import cv2
import numpy as np
import torch
from PIL import Image

MODELS_DIR = Path(__file__).resolve().parent.parent / "weights"
MODELS_DIR.mkdir(parents=True, exist_ok=True)

_lock = threading.Lock()
_upsampler = None
_face_enhancer = None


def _device() -> str:
    return "cuda" if torch.cuda.is_available() else "cpu"


def _load_models():
    """Lazily download + build the RealESRGAN and GFPGAN pipelines.

    Loading is expensive (weight download + GPU/CPU init), so it happens once
    per process behind a lock, not per request.
    """
    global _upsampler, _face_enhancer
    if _upsampler is not None:
        return _upsampler, _face_enhancer

    with _lock:
        if _upsampler is not None:
            return _upsampler, _face_enhancer

        from basicsr.archs.rrdbnet_arch import RRDBNet
        from realesrgan import RealESRGANer
        from gfpgan import GFPGANer

        model = RRDBNet(
            num_in_ch=3,
            num_out_ch=3,
            num_feat=64,
            num_block=23,
            num_grow_ch=32,
            scale=4,
        )
        upsampler = RealESRGANer(
            scale=4,
            model_path="https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth",
            model=model,
            tile=400,  # tile large images to bound memory use on CPU/small GPUs
            tile_pad=10,
            pre_pad=0,
            half=_device() == "cuda",
            device=_device(),
        )

        face_enhancer = GFPGANer(
            model_path="https://github.com/TencentARC/GFPGAN/releases/download/v1.3.0/GFPGANv1.3.pth",
            upscale=4,
            arch="clean",
            channel_multiplier=2,
            bg_upsampler=upsampler,
        )

        _upsampler, _face_enhancer = upsampler, face_enhancer
        return _upsampler, _face_enhancer


def _phone_style_grade(img_bgr: np.ndarray) -> np.ndarray:
    """Apply a mild computational-photography-style grade: local contrast
    (unsharp mask), a gentle S-curve for punch, and a small saturation lift.

    Kept subtle on purpose - the goal is "looks like it came off a modern
    phone", not a heavy filter that fights the upscaler's own detail.
    """
    img = img_bgr.astype(np.float32) / 255.0

    # Local contrast via unsharp mask.
    blurred = cv2.GaussianBlur(img, (0, 0), sigmaX=3)
    sharpened = np.clip(img + (img - blurred) * 0.6, 0, 1)

    # Gentle S-curve for tonal punch (lifts midtone contrast slightly).
    curved = sharpened + (sharpened - 0.5) * 0.08 * (1 - np.abs(sharpened - 0.5) * 2)
    curved = np.clip(curved, 0, 1)

    # Small saturation boost in HSV space.
    hsv = cv2.cvtColor((curved * 255).astype(np.uint8), cv2.COLOR_BGR2HSV).astype(np.float32)
    hsv[..., 1] = np.clip(hsv[..., 1] * 1.12, 0, 255)
    graded = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2BGR)

    return graded


def enhance_image(image: Image.Image, restore_faces: bool = True) -> Image.Image:
    """Runs upscaling (+ optional face restoration) and a phone-style grade.

    Returns a new PIL Image; the input is left untouched.
    """
    upsampler, face_enhancer = _load_models()

    img_bgr = cv2.cvtColor(np.array(image.convert("RGB")), cv2.COLOR_RGB2BGR)

    if restore_faces:
        _, _, output = face_enhancer.enhance(
            img_bgr, has_aligned=False, only_center_face=False, paste_back=True
        )
    else:
        output, _ = upsampler.enhance(img_bgr, outscale=4)

    graded = _phone_style_grade(output)
    return Image.fromarray(cv2.cvtColor(graded, cv2.COLOR_BGR2RGB))
