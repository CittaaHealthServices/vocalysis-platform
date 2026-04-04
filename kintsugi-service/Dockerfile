FROM python:3.11-slim

# System dependencies: ffmpeg for audio conversion, git+git-lfs for HuggingFace
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libsndfile1 \
    git \
    git-lfs \
    && git lfs install \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Pre-install huggingface_hub for model download step
RUN pip install --no-cache-dir huggingface_hub==0.23.0

# Download KintsugiHealth/dam model at build time so the container is ready
# immediately on deploy (no cold-start model download on first request).
# Model is ~500MB; build cache keeps this layer unless the repo changes.
RUN python -c "\
from huggingface_hub import snapshot_download; \
snapshot_download('KintsugiHealth/dam', local_dir='/app/dam', \
    ignore_patterns=['*.git', '*.gitattributes', 'training*', '*.ipynb'])"

# Install the DAM model's own requirements first (conda mamba → translated to pip)
WORKDIR /app/dam
RUN pip install --no-cache-dir \
    torch==2.2.0+cpu torchaudio==2.2.0+cpu \
    --extra-index-url https://download.pytorch.org/whl/cpu
# Install any requirements.txt shipped with the dam repo (if present)
RUN [ -f requirements.txt ] && pip install --no-cache-dir -r requirements.txt || true

# Install our service requirements
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy Flask app — placed in /app (NOT /app/dam) so our server code
# is separate from the DAM repo; sys.path insertion handles the import.
COPY app.py .
COPY gunicorn.conf.py .

EXPOSE 8001

# Use shell form so $PORT is expanded at runtime by Railway
CMD gunicorn app:app --config gunicorn.conf.py --bind 0.0.0.0:${PORT:-8001}
