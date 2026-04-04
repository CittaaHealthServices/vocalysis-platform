# Gunicorn config for Kintsugi DAM service
# Single worker: the Whisper model is NOT thread-safe and is large (~500MB).
# Multiple workers would each load a separate copy — wasteful on Railway's RAM.
# gthread worker with 2 threads handles concurrent requests on the single model.
workers     = 1
worker_class = 'gthread'
threads     = 2
timeout     = 180      # DAM inference on long audio can take ~30-60s on CPU
graceful_timeout = 60
keepalive   = 5
preload_app = True     # Load model once before forking (saves ~500MB RAM vs post-fork)
