"""
auto_retrain.py — Automatic Scheduled Retraining for VocoCore
=============================================================
Uses APScheduler to run ElevenLabs-based fine-tuning on a configurable
interval.  The scheduler starts when the Flask app starts and the model
keeps improving itself without any manual intervention.

Environment variables:
  ELEVENLABS_API_KEY          — required for ElevenLabs voice generation
  RETRAIN_INTERVAL_DAYS       — how often to retrain (default: 7)
  RETRAIN_MIN_ACCURACY_GAIN   — skip save if accuracy gain < this (default: 0.002)
  AUTO_RETRAIN_ENABLED        — set to "false" to disable (default: "true")

History file: training/retrain_history.json
  [ { run_id, started_at, completed_at, test_accuracy, real_audio_accuracy,
      f1, model_version, trigger, status, error } ]
"""

import os
import json
import logging
import threading
from pathlib import Path
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

HERE         = Path(__file__).parent
HISTORY_FILE = HERE / "training" / "retrain_history.json"
HISTORY_FILE.parent.mkdir(parents=True, exist_ok=True)

# ── Scheduler singleton ────────────────────────────────────────────────────────
_scheduler        = None
_scheduler_lock   = threading.Lock()
_current_run_id   = None


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
    """Return the last `limit` retraining runs (newest first)."""
    history = _load_history()
    return list(reversed(history[-limit:]))


def get_best_accuracy():
    """Return highest test_accuracy seen so far across all runs."""
    history = _load_history()
    accs = [r.get("test_accuracy", 0) for r in history if r.get("status") == "complete"]
    return max(accs) if accs else 0.0


# ── Core retrain job ───────────────────────────────────────────────────────────

def _run_scheduled_retrain(trigger="scheduled"):
    """
    Full auto-retrain cycle:
      1. Generate ElevenLabs audio
      2. Fine-tune model
      3. Compare accuracy — only hot-swap if it improved
      4. Append result to history log
    """
    api_key = os.environ.get("ELEVENLABS_API_KEY")
    if not api_key:
        logger.warning("[AutoRetrain] Skipping — ELEVENLABS_API_KEY not set")
        return

    run_id    = datetime.now(timezone.utc).strftime("run_%Y%m%d_%H%M%S")
    started   = datetime.now(timezone.utc).isoformat()
    entry     = {
        "run_id":    run_id,
        "trigger":   trigger,
        "started_at": started,
        "completed_at": None,
        "test_accuracy": None,
        "real_audio_accuracy": None,
        "f1": None,
        "model_version": None,
        "status": "running",
        "error": None,
    }
    _append_history(entry)

    logger.info(f"[AutoRetrain] Starting {run_id} (trigger={trigger})")

    try:
        from elevenlabs_trainer import (
            _generate_samples,
            _build_feature_matrix,
            _finetune,
            _hotswap_scorer,
            _update_status,
        )

        _update_status("running", f"[AutoRetrain {run_id}] Generating voice samples...")
        generated  = _generate_samples(api_key)
        total_clips = sum(len(v) for v in generated.values())
        logger.info(f"[AutoRetrain] {total_clips} clips generated")

        _update_status("running", f"[AutoRetrain {run_id}] Extracting features...")
        X_real, y_real = _build_feature_matrix(generated)
        logger.info(f"[AutoRetrain] {len(X_real)} feature rows built")

        if len(X_real) < 8:
            raise RuntimeError(f"Too few valid clips ({len(X_real)}) from ElevenLabs")

        _update_status("running", f"[AutoRetrain {run_id}] Fine-tuning ensemble...")
        _model, _scaler, meta = _finetune(X_real, y_real)

        new_acc   = float(meta.get("test_accuracy", 0))
        best_acc  = get_best_accuracy()
        min_gain  = float(os.environ.get("RETRAIN_MIN_ACCURACY_GAIN", "0.002"))

        if new_acc >= best_acc - min_gain:
            # Model is at least as good — hot-swap it in
            swapped = _hotswap_scorer()
            swap_msg = "hot-swap ok" if swapped else "hot-swap failed (scorer will reload on next request)"
            logger.info(f"[AutoRetrain] {run_id} — acc {new_acc*100:.1f}% ({swap_msg})")
        else:
            logger.warning(
                f"[AutoRetrain] {run_id} — new acc {new_acc*100:.1f}% < best {best_acc*100:.1f}% "
                f"(below {min_gain*100:.1f}% threshold) — keeping current model"
            )

        completed = datetime.now(timezone.utc).isoformat()

        # Update history entry
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
            f"[AutoRetrain {run_id}] acc={new_acc*100:.1f}% real={meta.get('real_audio_accuracy',0)*100:.1f}%"
        )
        logger.info(f"[AutoRetrain] {run_id} complete")

    except Exception as e:
        logger.error(f"[AutoRetrain] {run_id} failed: {e}", exc_info=True)
        try:
            from elevenlabs_trainer import _update_status
            _update_status("error", error=str(e))
        except Exception:
            pass

        # Update history with error
        history = _load_history()
        for r in history:
            if r["run_id"] == run_id:
                r.update({
                    "completed_at": datetime.now(timezone.utc).isoformat(),
                    "status": "error",
                    "error":  str(e),
                })
                break
        _save_history(history)


# ── Scheduler lifecycle ────────────────────────────────────────────────────────

def start_scheduler():
    """
    Start the APScheduler background scheduler.
    Called once from app.create_app().

    Schedule: every RETRAIN_INTERVAL_DAYS days (default 7).
    First run fires immediately after startup only if NO history exists yet
    (i.e., the model has never been trained on real audio).
    """
    global _scheduler

    if os.environ.get("AUTO_RETRAIN_ENABLED", "true").lower() == "false":
        logger.info("[AutoRetrain] Disabled via AUTO_RETRAIN_ENABLED=false")
        return

    api_key = os.environ.get("ELEVENLABS_API_KEY")
    if not api_key:
        logger.warning("[AutoRetrain] Scheduler NOT started — ELEVENLABS_API_KEY missing")
        return

    interval_days = int(os.environ.get("RETRAIN_INTERVAL_DAYS", "7"))

    with _scheduler_lock:
        if _scheduler is not None and _scheduler.running:
            logger.info("[AutoRetrain] Scheduler already running")
            return

        try:
            from apscheduler.schedulers.background import BackgroundScheduler
            from apscheduler.triggers.interval import IntervalTrigger

            _scheduler = BackgroundScheduler(
                job_defaults={"coalesce": True, "max_instances": 1},
                timezone="UTC",
            )

            _scheduler.add_job(
                func=lambda: _run_scheduled_retrain(trigger="scheduled"),
                trigger=IntervalTrigger(days=interval_days),
                id="auto_retrain",
                name=f"Auto ElevenLabs retrain every {interval_days} days",
                replace_existing=True,
            )

            _scheduler.start()

            history = _load_history()
            if not history:
                # No prior runs — fire immediately so the v3 model gets built right away
                logger.info("[AutoRetrain] No history found — triggering immediate first run")
                t = threading.Thread(
                    target=_run_scheduled_retrain,
                    kwargs={"trigger": "initial"},
                    daemon=True,
                )
                t.start()
            else:
                last = history[-1]
                logger.info(
                    f"[AutoRetrain] Scheduler started. Next run in {interval_days}d. "
                    f"Last run: {last.get('run_id')} status={last.get('status')} "
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
    """Gracefully shut down the scheduler (called on app teardown)."""
    global _scheduler
    with _scheduler_lock:
        if _scheduler and _scheduler.running:
            _scheduler.shutdown(wait=False)
            _scheduler = None
            logger.info("[AutoRetrain] Scheduler stopped")


def trigger_now(trigger="manual"):
    """Kick off an immediate retrain in a background thread (used by /retrain endpoint)."""
    t = threading.Thread(
        target=_run_scheduled_retrain,
        kwargs={"trigger": trigger},
        daemon=True,
    )
    t.start()
    return True, f"Retrain triggered ({trigger})"


def get_scheduler_info():
    """Return scheduler state + next run time for /health endpoint."""
    if _scheduler is None or not _scheduler.running:
        return {"running": False, "next_run": None}
    try:
        job = _scheduler.get_job("auto_retrain")
        next_run = job.next_run_time.isoformat() if job and job.next_run_time else None
    except Exception:
        next_run = None
    interval_days = int(os.environ.get("RETRAIN_INTERVAL_DAYS", "7"))
    return {
        "running":        True,
        "interval_days":  interval_days,
        "next_run":       next_run,
        "total_runs":     len(_load_history()),
        "best_accuracy":  round(get_best_accuracy(), 4),
    }
