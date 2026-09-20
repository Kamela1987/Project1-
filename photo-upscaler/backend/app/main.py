from __future__ import annotations

import io
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from PIL import Image

from .enhancer import enhance_image

MAX_UPLOAD_BYTES = 15 * 1024 * 1024  # 15 MB
MAX_INPUT_DIMENSION = 2000  # px; upscaling 4x beyond this gets slow/huge fast

app = FastAPI(title="Photo Upscaler")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/enhance")
async def enhance(file: UploadFile = File(...), restore_faces: bool = True):
    if file.content_type not in {"image/jpeg", "image/png", "image/webp"}:
        raise HTTPException(400, "Upload a JPEG, PNG or WebP image.")

    raw = await file.read()
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(400, f"File too large; limit is {MAX_UPLOAD_BYTES // (1024 * 1024)} MB.")

    try:
        image = Image.open(io.BytesIO(raw))
        image.load()
    except Exception:
        raise HTTPException(400, "Could not read that file as an image.")

    if max(image.size) > MAX_INPUT_DIMENSION:
        image.thumbnail((MAX_INPUT_DIMENSION, MAX_INPUT_DIMENSION), Image.LANCZOS)

    try:
        result = enhance_image(image, restore_faces=restore_faces)
    except Exception as exc:  # model/runtime failure -> surface as 500, not a crash
        raise HTTPException(500, f"Enhancement failed: {exc}")

    buf = io.BytesIO()
    result.save(buf, format="JPEG", quality=95)
    buf.seek(0)
    return StreamingResponse(buf, media_type="image/jpeg")


def _find_frontend_dir() -> Path:
    # Docker image layout: /app/app/main.py, frontend at /app/frontend.
    # Local (run from repo checkout): backend/app/main.py, frontend at ../../frontend.
    for candidate in (
        Path(__file__).resolve().parent.parent / "frontend",
        Path(__file__).resolve().parent.parent.parent / "frontend",
    ):
        if candidate.is_dir():
            return candidate
    raise RuntimeError("Could not locate the frontend/ directory.")


app.mount("/", StaticFiles(directory=str(_find_frontend_dir()), html=True), name="frontend")
