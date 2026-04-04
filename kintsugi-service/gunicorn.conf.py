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
# preload_app must be False: with preload_app=True the master forks the worker
# before the warmup thread (which loads the model) finishes, and threads do NOT
# survive fork(). The worker would start with _pipeline=None and no warmup thread.
# With preload_app=False the worker loads the app itself and the warmup thread
# runs correctly inside the worker process.
preload_app = False
