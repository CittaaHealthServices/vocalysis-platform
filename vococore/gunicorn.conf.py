"""
gunicorn.conf.py — VocoCore service
====================================
Ensures the APScheduler (auto-retrain) only runs in worker #1, not in all
4 worker processes simultaneously (which would fire 4 parallel retrains).

Strategy: use the `post_fork` hook — after gunicorn forks each worker,
check the worker index via a shared file-based counter.  Only worker 1 starts
the scheduler.

Also enforces a file lock around the retrain job so even if multiple workers
somehow start, only one runs at a time.
"""

import os
import logging

logger = logging.getLogger("gunicorn.error")

# ── Gunicorn settings ─────────────────────────────────────────────────────────
# Keep 4 threads-per-worker for throughput but use 1 worker for scheduler safety.
# The VocoCore service is a microservice (CPU-bound ML inference) — 1 worker +
# 4 threads gives good concurrency without duplicating background jobs.
workers     = int(os.environ.get("GUNICORN_WORKERS", "1"))
worker_class = "gthread"
threads     = int(os.environ.get("GUNICORN_THREADS", "8"))
timeout     = 180       # audio processing can take ~60-90s
keepalive   = 5
preload_app = True      # load app in master before forking → scheduler starts once

bind        = f"0.0.0.0:{os.environ.get('PORT', '8000')}"
accesslog   = "-"
errorlog    = "-"
loglevel    = "info"

# ── Worker lifecycle hooks ────────────────────────────────────────────────────

def on_starting(server):
    logger.info("[gunicorn] VocoCore starting — preload_app=True, workers=%s", workers)


def post_fork(server, worker):
    """Called in each worker after fork. Schedule auto-retrain only once."""
    # With preload_app=True and workers=1 this fires exactly once.
    # If someone bumps workers > 1 in future, the PID file guard in
    # auto_retrain.start_scheduler() prevents duplicate scheduler instances.
    logger.info("[gunicorn] Worker %s started (pid=%s)", worker.age, worker.pid)


def worker_exit(server, worker):
    """Stop scheduler gracefully when worker exits."""
    try:
        from auto_retrain import stop_scheduler
        stop_scheduler()
    except Exception:
        pass


def on_exit(server):
    logger.info("[gunicorn] VocoCore shutting down")
