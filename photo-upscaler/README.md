# Photo Upscaler

A self-hosted web app that enhances photos using open-source AI models
(Real-ESRGAN for 4x super-resolution, GFPGAN for face restoration), plus a
light tone/contrast/saturation grade to give results a modern
computational-photography look.

**What this is not:** a way to recover detail a camera never captured.
"Make it look like an iPhone 16 Pro shot" isn't a measurable target — there's
no ground truth for what a scene would have looked like through a different
sensor. What this does is sharpen, denoise, upscale 4x, restore faces, and
apply a phone-style grade so the result *reads* like it came from better
hardware. Good for casual/social use; don't rely on it for anything needing
forensic accuracy.

## Stack

- **Backend:** FastAPI (Python), Real-ESRGAN + GFPGAN (self-hosted, weights
  auto-download on first request from the official GitHub releases).
- **Frontend:** plain HTML/CSS/JS, no build step, served by the backend.
- Runs on CPU (slow, ~30-90s per image) or GPU (fast, ~2-5s per image) —
  whichever `torch` detects.

## Run it

### Docker (recommended)

```bash
cd photo-upscaler
docker compose up --build
```

Then open http://localhost:8000. First request will be slow while it
downloads the Real-ESRGAN (~65MB) and GFPGAN (~350MB) weights; they're cached
in a Docker volume after that.

### Without Docker

```bash
cd photo-upscaler/backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --app-dir . --host 0.0.0.0 --port 8000
```

**Known issue after a fresh install (both Docker and manual):** `basicsr==1.4.2`
imports `torchvision.transforms.functional_tensor`, which torchvision removed
in 0.17+ — every `/api/enhance` request 500s with `No module named
'torchvision.transforms.functional_tensor'` until this is patched. The
Dockerfile patches it automatically; for a manual install, run this once
after `pip install`:

```bash
sed -i \
  's/from torchvision.transforms.functional_tensor import rgb_to_grayscale/from torchvision.transforms.functional import rgb_to_grayscale/' \
  .venv/lib/python3.*/site-packages/basicsr/data/degradations.py
```

## GPU acceleration

If you have an NVIDIA GPU, install the CUDA build of PyTorch matching your
driver (see https://pytorch.org/get-started/locally/) before installing
`requirements.txt`, and for Docker use an `nvidia/cuda` base image with the
NVIDIA Container Toolkit. CPU inference works but is much slower on large
images — the API downsamples anything over 2000px on its longest side before
upscaling to keep processing time bounded.

## API

`POST /api/enhance` — multipart form upload, field name `file`
(JPEG/PNG/WebP, ≤15MB). Optional query param `restore_faces` (default
`true`). Returns the enhanced image as JPEG.

`GET /api/health` — liveness check.

## Limits / things to know

- 4x upscale on a 2000px image produces an 8000px output — large files,
  and slow on CPU. Tune `MAX_INPUT_DIMENSION` in `backend/app/main.py` if
  you need faster turnaround over max resolution.
- Face restoration (GFPGAN) works best on photos where faces are reasonably
  visible; it's skipped in effect (falls back to plain upscaling quality)
  on scenes with no detectable faces.
- The phone-style grade in `backend/app/enhancer.py::_phone_style_grade` is
  intentionally subtle. Adjust the sharpening/saturation constants there if
  you want a stronger or lighter look.
