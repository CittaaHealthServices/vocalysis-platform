"""
auto_retrain.py — Continuous Automatic Retraining for VocoCore
==============================================================
Runs ElevenLabs-based fine-tuning continuously on two triggers:

  1. TIME-based  — every RETRAIN_INTERVAL_DAYS days  (default: 2)
  2. SESSION-based — every RETRAIN_SESSION_COUNT new real sessions (default: 50)
     (counted via /session-trained endpoint called by the API after each check-in)

A file lock (training/retrain.lock) prevents duplicate runs even if APScheduler
somehow fires twice (e.g., multiple gunicorn workers).

Environment variables:
  ELEVENLABS_API_KEY          — required for ElevenLabs voice generation
  RETRAIN_INTERVAL_DAYS       — time-based trigger interval (default: 2)
  RETRAIN_SESSION_COUNT       — session-count trigger threshold (default: 50)
  RETRAIN_MIN_ACCURACY_GAIN   — only hot-swap if new_acc >= best_acc - this (default: 0.002)
  AUTO_RETRAIN_ENABLED        — set to "false" to disable (default: "true")

History file: training/retrain_history.json
"""

import os
import json
import fcntl
import logging
import threading
from pathlib import Path
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

HERE          = Path(__file__).parent
HISTORY_FILE  = HERE / "training" / "retrain_history.json"
LOCK_FILE     = HERE / "training" / "retrain.lock"
SESSION_COUNT_FILE = HERE / "training" / "session_counter.json"

for p in [HISTORY_FILE.parent]:
    p.mkdir(parents=True, exist_ok=True)

# ── Scheduler singleton ────────────────────────────────────────────────────────
_scheduler      = None
_scheduler_lock = threading.Lock()

# ── History helpers ────────────────────────────────────────────────────────────

def _load_history():
    if HISTORY_FILE.exists():
        try:
            return json.loads(HISTORY_FILE.read_text())
        except Exception:
            pass
    return []


def _save_history(history):
    HISTORY_FILE.write_text(json.dumps(history, indent=2))


def _append_history(entry):
    history = _load_history()
    history.append(entry)
    _save_history(history)
    return entry


def get_history(limit=20):
    history = _load_history()
    return list(reversed(history[-limit:]))


def get_best_accuracy():
    history = _load_history()
    accs = [r.get("test_accuracy", 0) for r in history if r.get("status") == "complete"]
    return max(accs) if accs else 0.0


# ── Session counter (session-based trigger) ───────────────────────────────────

def _load_session_counter():
    if SESSION_COUNT_FILE.exists():
        try:
            return json.loads(SESSION_COUNT_FILE.read_text())
        except Exception:
            pass
    return {"count": 0, "last_retrain_count": 0}


def _save_session_counter(data):
    SESSION_COUNT_FILE.write_text(json.dumps(data))


def increment_session_counter():
    """
    Called after each real employee check-in is processed.
    Returns True if the session-count threshold is hit → caller should trigger retrain.
    """
    threshold = int(os.environ.get("RETRAIN_SESSION_COUNT", "50"))
    data = _load_session_counter()
    data["count"] = data.get("count", 0) + 1
    _save_session_counter(data)

    since_last = data["count"] - data.get("last_retrain_count", 0)
    if since_last >= threshold:
        data["last_retrain_count"] = data["count"]
        _save_session_counter(data)
        logger.info(
            f"[AutoRetrain] Session threshold reached ({since_last} new sessions >= {threshold}) — triggering retrain"
        )
        return True
    return False


def get_session_counter():
    data = _load_session_counter()
    threshold = int(os.environ.get("RETRAIN_SESSION_COUNT", "50"))
    return {
        "total_sessions": data.get("count", 0),
        "sessions_since_last_retrain": data.get("count", 0) - data.get("last_retrain_count", 0),
        "threshold": threshold,
    }


# ── File-lock guard (prevents duplicate concurrent runs) ─────────────────────

class _RetainLock:
    """Context manager that acquires an exclusive flock. Returns False if already locked."""
    def __init__(self):
        self._fd = None

    def __enter__(self):
        try:
            LOCK_FILE.parent.mkdir(parents=True, exist_ok=True)
            self._fd = open(LOCK_FILE, "w")
            fcntl.flock(self._fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
            return True
        except (IOError, OSError):
            if self._fd:
                self._fd.close()
                self._fd = None
            return False

    def __exit__(self, *args):
        if self._fd:
            try:
                fcntl.flock(self._fd, fcntl.LOCK_UN)
                self._fd.close()
            except Exception:
                pass
            self._fd = None


# ── Core retrain job ───────────────────────────────────────────────────────────

def _run_scheduled_retrain(trigger="scheduled"):
    """
    Full auto-retrain cycle. File-locked so only one instance runs at a time.
      1. Generate ElevenLabs audio for all 4 classes
      2. Extract 56 acoustic features per clip
      3. Fine-tune XGB+RF ensemble (real × 3 weight)
      4. Compare accuracy — hot-swap only if improved
      5. Append result to history log
    """
    api_key = os.environ.get("ELEVENLABS_API_KEY")
    if not api_key:
        logger.warning("[AutoRetrain] Skipping — ELEVENLABS_API_KEY not set")
        return

    lock = _RetainLock()
    acquired = lock.__enter__()
    if not acquired:
        logger.info("[AutoRetrain] Another retrain is already running — skipping")
        return

    run_id  = datetime.now(timezone.utc).strftime("run_%Y%m%d_%H%M%S")
    started = datetime.now(timezone.utc).isoformat()
    entry   = {
        "run_id":              run_id,
        "trigger":             trigger,
        "started_at":          started,
        "completed_at":        None,
        "test_accuracy":       None,
        "real_audio_accuracy": None,
        "f1":                  None,
        "model_version":       None,
        "status":              "running",
        "error":               None,
    }
    _append_history(entry)
    logger.info(f"[AutoRetrain] {run_id} started (trigger={trigger})")

    try:
        from elevenlabs_trainer import (
            _generate_samples,
            _build_feature_matrix,
            _finetune,
            _hotswap_scorer,
            _update_status,
        )

        _update_status("running", f"[{run_id}] Generating voice samples via ElevenLabs...")
        generated   = _generate_samples(api_key)
        total_clips = sum(len(v) for v in generated.values())
        logger.info(f"[AutoRetrain] {total_clips} audio clips generated")

        _update_status("running", f"[{run_id}] Extracting acoustic features ({total_clips} clips)...")
        X_real, y_real = _build_feature_matrix(generated)
        logger.info(f"[AutoRetrain] {len(X_real)} valid feature rows extracted")

        if len(X_real) < 8:
            raise RuntimeError(f"Too few valid clips ({len(X_real)}) — check ElevenLabs API key / audio quality")

        _update_status("running", f"[{run_id}] Fine-tuning ML ensemble ({len(X_real)} samples)...")
        _model, _scaler, meta = _finetune(X_real, y_real)

        new_acc  = float(meta.get("test_accuracy", 0))
        best_acc = get_best_accuracy()
        min_gain = float(os.environ.get("RETRAIN_MIN_ACCURACY_GAIN", "0.002"))

        if new_acc >= best_acc - min_gain:
            swapped  = _hotswap_scorer()
            swap_msg = "hot-swap ok" if swapped else "hot-swap failed (reloads on next request)"
            logger.info(f"[AutoRetrain] {run_id} — acc {new_acc*100:.1f}%  {swap_msg}")
        else:
            logger.warning(
                f"[AutoRetrain] {run_id} — new acc {new_acc*100:.1f}% < best {best_acc*100:.1f}% "
                f"(below -{min_gain*100:.1f}% threshold) — keeping current model"
            )

        completed = datetime.now(timezone.utc).isoformat()
        history = _load_history()
        for r in history:
            if r["run_id"] == run_id:
                r.update({
                    "completed_at":        completed,
                    "test_accuracy":       new_acc,
                    "real_audio_accuracy": float(meta.get("real_audio_accuracy", 0)),
                    "f1":                  float(meta.get("test_f1", 0)),
                    "model_version":       meta.get("version", "unknown"),
                    "clips_generated":     total_clips,
                    "samples_extracted":   int(len(X_real)),
                    "status":              "complete",
                    "error":               None,
                })
                break
        _save_history(history)

        _update_status(
            "complete",
            f"[{run_id}] acc={new_acc*100:.1f}%  real={meta.get('real_audio_accuracy',0)*100:.1f}%  {swap_msg}"
        )
        logger.info(f"[AutoRetrain] {run_id} complete")

    except Exception as e:
        logger.error(f"[AutoRetrain] {run_id} failed: {e}", exc_info=True)
        try:
            from elevenlabs_trainer import _update_status
            _update_status("error", error=str(e))
        except Exception:
            pass
        history = _load_history()
        for r in history:
            if r["run_id"] == run_id:
                r.update({
                    "completed_at": datetime.now(timezone.utc).isoformat(),
                    "status":       "error",
                    "error":        str(e),
                })
                break
        _save_history(history)
    finally:
        lock.__exit__(None, None, None)


# ── Scheduler lifecycle ────────────────────────────────────────────────────────

def start_scheduler():
    """
    Start APScheduler background scheduler with two job triggers:
      - Time-based: every RETRAIN_INTERVAL_DAYS days (default 2)
      - Guarded by preload_app=True + workers=1 in gunicorn.conf.py so only
        one scheduler instance exists across all workers.

    On first startup (no history), fires an immediate initial run.
    """
    global _scheduler

    if os.environ.get("AUTO_RETRAIN_ENABLED", "true").lower() == "false":
        logger.info("[AutoRetrain] Disabled via AUTO_RETRAIN_ENABLED=false")
        return

    api_key = os.environ.get("ELEVENLABS_API_KEY")
    if not api_key:
        logger.warning("[AutoRetrain] Scheduler NOT started — ELEVENLABS_API_KEY missing")
        return

    interval_days = int(os.environ.get("RETRAIN_INTERVAL_DAYS", "2"))

    with _scheduler_lock:
        if _scheduler is not None and _scheduler.running:
            logger.info("[AutoRetrain] Scheduler already running — skipping duplicate start")
            return

        try:
            from apscheduler.schedulers.background import BackgroundScheduler
            from apscheduler.triggers.interval import IntervalTrigger

            _scheduler = BackgroundScheduler(
                job_defaults={"coalesce": True, "max_instances": 1, "misfire_grace_time": 3600},
                timezone="UTC",
            )

            _scheduler.add_job(
                func=lambda: _run_scheduled_retrain(trigger="scheduled"),
                trigger=IntervalTrigger(days=interval_days),
                id="auto_retrain_time",
                name=f"ElevenLabs retrain every {interval_days} days",
                replace_existing=True,
            )

            _scheduler.start()
            logger.info(f"[AutoRetrain] Scheduler started — interval={interval_days}d  session_threshold={os.environ.get('RETRAIN_SESSION_COUNT', '50')}")

            # Fire immediately if no history (first deployment)
            history = _load_history()
            if not history:
                logger.info("[AutoRetrain] No history — triggering immediate first retrain")
                t = threading.Thread(
                    target=_run_scheduled_retrain,
                    kwargs={"trigger": "initial"},
                    daemon=True,
                )
                t.start()
            else:
                last = history[-1]
                logger.info(
                    f"[AutoRetrain] Last run: {last.get('run_id')}  "
                    f"status={last.get('status')}  "
                    f"acc={last.get('test_accuracy', 0)*100:.1f}%"
                )

        except ImportError:
            logger.warning(
                "[AutoRetrain] APScheduler not installed — auto-retraining disabled. "
                "Add APScheduler>=3.10.0 to requirements.txt"
            )
        except Exception as e:
            logger.error(f"[AutoRetrain] Scheduler startup failed: {e}", exc_info=True)


def stop_scheduler():
    global _scheduler
    with _scheduler_lock:
        if _scheduler and _scheduler.running:
            _scheduler.shutdown(wait=False)
            _scheduler = None
            logger.info("[AutoRetrain] Scheduler stopped")


def trigger_now(trigger="manual"):
    """Kick off an immediate retrain in a background thread."""
    t = threading.Thread(
        target=_run_scheduled_retrain,
        kwargs={"trigger": trigger},
        daemon=True,
    )
    t.start()
    return True, f"Retrain triggered ({trigger})"


def get_scheduler_info():
    interval_days = int(os.environ.get("RETRAIN_INTERVAL_DAYS", "2"))
    if _scheduler is None or not _scheduler.running:
        return {
            "running":       False,
            "interval_days": interval_days,
            "next_run":      None,
            "total_runs":    len(_load_history()),
            "best_accuracy": round(get_best_accuracy(), 4),
            **get_session_counter(),
        }
    try:
        job      = _scheduler.get_job("auto_retrain_time")
        next_run = job.next_run_time.isoformat() if job and job.next_run_time else None
    except Exception:
        next_run = None
    return {
        "running":       True,
        "interval_days": interval_days,
        "next_run":      next_run,
        "total_runs":    len(_load_history()),
        "best_accuracy": round(get_best_accuracy(), 4),
        **get_session_counter(),
    }
