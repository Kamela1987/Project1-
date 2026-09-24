FROM python:3.10-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# basicsr==1.4.2 (a realesrgan/gfpgan dependency) imports
# torchvision.transforms.functional_tensor, which torchvision removed in
# 0.17+ — basicsr predates that removal and was never updated. Without this,
# every /api/enhance request 500s with "No module named
# 'torchvision.transforms.functional_tensor'". rgb_to_grayscale still exists
# at the same signature under the public torchvision.transforms.functional
# module, so this just repoints the one broken import.
RUN sed -i \
    's/from torchvision.transforms.functional_tensor import rgb_to_grayscale/from torchvision.transforms.functional import rgb_to_grayscale/' \
    /usr/local/lib/python3.10/site-packages/basicsr/data/degradations.py

COPY backend/app ./app
COPY frontend ./frontend

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
