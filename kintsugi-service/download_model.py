"""
download_model.py — retries HuggingFace snapshot_download up to 5 times
with exponential backoff.  Called from the Dockerfile at build time so the
model is baked into the image (no cold-start download on first request).
"""
import sys
import time

from huggingface_hub import snapshot_download

REPO_ID = "KintsugiHealth/dam"
LOCAL_DIR = "/app/dam"
IGNORE_PATTERNS = ["*.git", "*.gitattributes", "training*", "*.ipynb"]
MAX_ATTEMPTS = 5

for attempt in range(1, MAX_ATTEMPTS + 1):
    try:
        print(f"[download_model] Attempt {attempt}/{MAX_ATTEMPTS}: {REPO_ID} → {LOCAL_DIR}", flush=True)
        snapshot_download(
            repo_id=REPO_ID,
            local_dir=LOCAL_DIR,
            ignore_patterns=IGNORE_PATTERNS,
        )
        print(f"[download_model] Download complete on attempt {attempt}", flush=True)
        sys.exit(0)
    except Exception as exc:
        print(f"[download_model] Attempt {attempt} failed: {exc}", file=sys.stderr, flush=True)
        if attempt < MAX_ATTEMPTS:
            wait = 10 * attempt   # 10s, 20s, 30s, 40s
            print(f"[download_model] Retrying in {wait}s…", flush=True)
            time.sleep(wait)
        else:
            print("[download_model] All attempts exhausted — giving up", file=sys.stderr, flush=True)
            sys.exit(1)
