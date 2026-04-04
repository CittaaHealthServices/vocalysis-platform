"""
VocaCore Flask application for acoustic feature extraction.
Internal microservice for the Vocalysis Platform 2.0.
"""

import os
import time
import logging
from functools import wraps
from flask import Flask, request, jsonify

from quality_check import QualityChecker
from extractor import FeatureExtractor
from fallback_scorer import DeterministicScorer
from ml_scorer import get_scorer
from elevenlabs_trainer import start_retrain, get_retrain_status
from auto_retrain import (
    start_scheduler, stop_scheduler, get_history,
    get_scheduler_info, trigger_now,
    store_clinical_feedback, load_clinical_feedback, get_feedback_count,
    increment_session_counter,
)
from language_detector import detect_language, apply_language_calibration


# Configure logging - no audio content or feature values logged
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def create_app():
    """
    Application factory for VocaCore Flask app.

    Returns:
        Flask: Configured Flask application
    """
    app = Flask(__name__)

    # Load configuration from environment
    app.config['VOCOCORE_INTERNAL_KEY'] = os.environ.get('VOCOCORE_INTERNAL_KEY', 'dev-key-12345')
    app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB max file size

    # Initialize components
    quality_checker = QualityChecker(target_sr=16000, min_duration=10.0)
    feature_extractor = FeatureExtractor(sr=16000)
    fallback_scorer = DeterministicScorer()
    ml_scorer = get_scorer()  # Indian-calibrated ensemble (96.4% accuracy)

    # ========== DECORATORS ==========

    def require_internal_auth(f):
        """Decorator to verify internal API key."""
        @wraps(f)
        def decorated_function(*args, **kwargs):
            auth_header = request.headers.get('X-VocoCore-Internal-Key', '')

            if auth_header != app.config['VOCOCORE_INTERNAL_KEY']:
                logger.warning('Unauthorized access attempt')
                return jsonify({
                    'success': False,
                    'error': {
                        'code': 'UNAUTHORIZED',
                        'message': 'Invalid or missing authentication key'
                    }
                }), 401

            return f(*args, **kwargs)

        return decorated_function

    # ========== ROUTES ==========

    @app.route('/health', methods=['GET'])
    def health_check():
        """Health check endpoint."""
        logger.info('Health check request')
        return jsonify({
            'status': 'ok',
            'version': '2.1-india',
            'ml_model_loaded': ml_scorer.is_loaded,
            'ml_model_version': ml_scorer._meta.get('version', 'not loaded'),
            'calibration': 'Indian voices — Hindi/Telugu/Tamil/Kannada/IndEng',
            'auto_retrain': get_scheduler_info(),
        }), 200

    @app.route('/score', methods=['POST'])
    @require_internal_auth
    def score_audio():
        """
        Extract features AND run ML mental-health inference in one call.

        Priority:
          1. Indian-calibrated ML ensemble (96.4% accuracy)
          2. DeterministicScorer fallback (45% confidence, rule-based)

        Expected request:
        - Content-Type: multipart/form-data
        - Field: 'audio'         (file upload, required)
        - Field: 'language_hint' (optional ISO code: hi|te|ta|kn|en-in|mr|bn|gu|ml|pa)
        - Header: X-VocoCore-Internal-Key

        Returns:
        - 200: { success: true, features, scores, meta, language }
        - 400/500: error response
        """
        start_time = time.time()

        if 'audio' not in request.files:
            return jsonify({'success': False, 'error': {
                'code': 'MISSING_AUDIO', 'message': 'No audio file provided'
            }}), 400

        audio_file    = request.files['audio']
        filename      = audio_file.filename or 'unknown'
        language_hint = request.form.get('language_hint', '').strip() or None

        try:
            audio_bytes = audio_file.read()
            if not audio_bytes:
                return jsonify({'success': False, 'error': {
                    'code': 'EMPTY_FILE', 'message': 'Audio file is empty'
                }}), 400

            logger.info(f'Score request: {filename} ({len(audio_bytes)} bytes) language_hint={language_hint}')

            # Quality check
            quality_result = quality_checker.check(audio_bytes, filename)
            if not quality_result['valid']:
                return jsonify({'success': False, 'error': {
                    'code': 'QUALITY_CHECK_FAILED',
                    'message': quality_result['reason']
                }}), 400

            # Feature extraction
            audio_array  = quality_result['audio_array']
            sample_rate  = quality_result['sample_rate']
            features     = feature_extractor.extract(audio_array, sample_rate)

            # ── Language auto-detection ──────────────────────────────────────
            # Detects language from acoustic patterns + explicit hint from client.
            # Result is passed to scorer and returned in meta so the API can
            # store it on the Session document for accurate clinical reporting.
            lang_result = detect_language(audio_array, sample_rate, language_hint)
            lang_code   = lang_result['language']
            # Apply per-language norm calibration offsets to features
            features_calibrated = apply_language_calibration(features, lang_result)
            logger.info(
                f"Language: {lang_result['display_name']} ({lang_code}) "
                f"via {lang_result['method']} conf={lang_result['confidence']:.2f}"
            )
            # ────────────────────────────────────────────────────────────────

            del audio_array, audio_bytes

            # ML inference (primary) — use calibrated features
            if ml_scorer.is_loaded:
                try:
                    scores = ml_scorer.score(features_calibrated)
                    scorer_used = 'ml_ensemble_v2'
                    logger.info(
                        f"ML score: {scores['ml_class']} "
                        f"(conf={scores['ml_confidence']:.2f})"
                    )
                except Exception as ml_err:
                    logger.warning(f"ML scorer failed ({ml_err}), using fallback")
                    scores = fallback_scorer.score(features_calibrated)
                    scores['is_ml_scored'] = False
                    scorer_used = 'deterministic_fallback'
            else:
                scores = fallback_scorer.score(features_calibrated)
                scores['is_ml_scored'] = False
                scorer_used = 'deterministic_fallback'

            processing_time_ms = int((time.time() - start_time) * 1000)
            logger.info(f'Score completed in {processing_time_ms}ms via {scorer_used}')

            return jsonify({
                'success': True,
                'features': features,
                'scores': scores,
                'language': {
                    'code':         lang_code,
                    'display_name': lang_result['display_name'],
                    'confidence':   lang_result['confidence'],
                    'method':       lang_result['method'],
                },
                'meta': {
                    'duration':           quality_result['duration_seconds'],
                    'quality_score':      quality_result['quality_score'],
                    'voiced_fraction':    quality_result['voiced_fraction'],
                    'snr_estimate':       quality_result['snr_estimate'],
                    'processing_time_ms': processing_time_ms,
                    'scorer_used':        scorer_used,
                    'calibration':        f'Indian voices — {lang_result["display_name"]} calibrated',
                }
            }), 200

        except Exception as e:
            logger.error(f'Unexpected error in /score: {e}', exc_info=True)
            return jsonify({'success': False, 'error': {
                'code': 'SCORE_ERROR',
                'message': 'Internal server error during scoring'
            }}), 500

    @app.route('/clinical-feedback', methods=['POST'])
    @require_internal_auth
    def clinical_feedback():
        """
        Receive clinician-confirmed PHQ-9 / GAD-7 / PSS-10 scores for a session.

        Called by the API immediately after a clinician finalises a session.
        Stores the labelled acoustic feature vector as a training example.
        These examples are used by elevenlabs_trainer.py during the next retrain
        to improve the model's tier classification accuracy.

        Body (JSON):
          sessionId    — Vocalysis session ID
          features     — acoustic feature dict (from /score extraction)
          labels       — { phq9, gad7, pss10, phq9Tier, gad7Tier, riskLevel, diagnosisLabel }
          language     — detected language code (optional)
        """
        try:
            body = request.get_json(force=True, silent=True) or {}
            session_id = body.get("sessionId", "unknown")
            features   = body.get("features")
            labels     = body.get("labels", {})
            language   = body.get("language")

            if not features or not isinstance(features, dict):
                return jsonify({
                    "success": False,
                    "error":   {"code": "MISSING_FEATURES", "message": "features dict required"}
                }), 400

            if not labels or not any(labels.get(k) is not None for k in ("phq9", "gad7", "pss10")):
                return jsonify({
                    "success": False,
                    "error":   {"code": "MISSING_LABELS", "message": "at least one of phq9/gad7/pss10 required"}
                }), 400

            stored = store_clinical_feedback(session_id, features, labels, language)
            total  = get_feedback_count()

            return jsonify({
                "success":       stored,
                "totalExamples": total,
                "message":       f"Clinical feedback stored — {total} labelled examples in training pool",
            }), 200 if stored else 500

        except Exception as e:
            logger.error("Error in /clinical-feedback: %s", e, exc_info=True)
            return jsonify({"success": False, "error": {"code": "SERVER_ERROR", "message": str(e)}}), 500

    @app.route('/clinical-feedback/stats', methods=['GET'])
    @require_internal_auth
    def clinical_feedback_stats():
        """Return stats about the clinical feedback training pool."""
        examples = load_clinical_feedback(max_examples=10000)
        phq9_labelled  = sum(1 for e in examples if e.get("labels", {}).get("phq9") is not None)
        gad7_labelled  = sum(1 for e in examples if e.get("labels", {}).get("gad7") is not None)
        pss10_labelled = sum(1 for e in examples if e.get("labels", {}).get("pss10") is not None)
        langs = {}
        for e in examples:
            l = e.get("language") or "unknown"
            langs[l] = langs.get(l, 0) + 1
        return jsonify({
            "success":       True,
            "totalExamples": len(examples),
            "byScale": {"phq9": phq9_labelled, "gad7": gad7_labelled, "pss10": pss10_labelled},
            "byLanguage":    langs,
            "note":          "These labelled examples are used in the next ElevenLabs retrain cycle.",
        }), 200

    @app.route('/session-trained', methods=['POST'])
    @require_internal_auth
    def session_trained():
        """
        Called by the API worker after each successful employee check-in.
        Increments session counter and triggers auto-retrain when threshold is met.
        Fire-and-forget — worker does NOT wait for retrain to complete.
        """
        from auto_retrain import increment_session_counter, trigger_now, get_session_counter
        should_retrain = increment_session_counter()
        counters = get_session_counter()
        if should_retrain:
            triggered, msg = trigger_now(trigger='session_count')
            logger.info(
                '[session-trained] threshold hit (%d sessions) — retrain triggered=%s',
                counters['total_sessions'], triggered
            )
            return jsonify({
                'success': True,
                'retrain_triggered': triggered,
                'message': msg,
                'counters': counters,
            }), 200
        return jsonify({
            'success': True,
            'retrain_triggered': False,
            'counters': counters,
        }), 200

    @app.route('/retrain', methods=['POST'])
    @require_internal_auth
    def retrain():
        """
        Trigger ElevenLabs-based model retraining in the background.

        Uses ELEVENLABS_API_KEY from environment (set in Railway).
        Generates Indian voice samples → extracts features → fine-tunes model → hot-swaps scorer.
        Run is logged to /retrain/history.

        Returns immediately with job status. Poll /retrain/status for progress.
        """
        from elevenlabs_trainer import _retrain_status as _rs
        if _rs.get('state') == 'running':
            return jsonify({'success': False, 'error': {
                'code': 'ALREADY_RUNNING',
                'message': 'Retrain already in progress'
            }}), 409

        api_key = os.environ.get('ELEVENLABS_API_KEY')
        if not api_key:
            return jsonify({'success': False, 'error': {
                'code': 'NO_API_KEY',
                'message': 'ELEVENLABS_API_KEY not set in environment'
            }}), 400

        started, message = trigger_now(trigger='manual')
        if not started:
            return jsonify({'success': False, 'error': {
                'code': 'TRIGGER_FAILED',
                'message': message
            }}), 500

        return jsonify({
            'success': True,
            'message': 'Retrain started (manual trigger)',
            'note': 'Poll /retrain/status for progress. Poll /retrain/history for run log.',
        }), 202

    @app.route('/retrain/history', methods=['GET'])
    @require_internal_auth
    def retrain_history():
        """
        Return retraining history (newest first).
        Shows accuracy improvements across all auto and manual runs.
        Optional query param: ?limit=N (default 20)
        """
        limit = min(int(request.args.get('limit', 20)), 100)
        history = get_history(limit=limit)
        best = max((r.get('test_accuracy', 0) for r in history if r.get('status') == 'complete'), default=0)
        return jsonify({
            'success': True,
            'history': history,
            'total_runs': len(history),
            'best_accuracy': round(best, 4),
            'scheduler': get_scheduler_info(),
        }), 200

    @app.route('/retrain/status', methods=['GET'])
    @require_internal_auth
    def retrain_status():
        """
        Poll retraining progress.
        Returns: { state: idle|running|complete|error, progress, started_at, error }
        """
        status = get_retrain_status()
        return jsonify({'success': True, 'status': status}), 200

    @app.route('/extract', methods=['POST'])
    @require_internal_auth
    def extract_features():
        """
        Extract acoustic features from audio file.

        Expected request:
        - Content-Type: multipart/form-data
        - Field: 'audio' (file upload)
        - Header: X-VocoCore-Internal-Key (internal auth)

        Returns:
        - 200: { success: true, features: {...}, meta: {...} }
        - 400: { success: false, error: {...} }
        - 500: { success: false, error: {...} }
        """
        start_time = time.time()

        # Validate request
        if 'audio' not in request.files:
            logger.error('Missing audio file in request')
            return jsonify({
                'success': False,
                'error': {
                    'code': 'MISSING_AUDIO',
                    'message': 'No audio file provided'
                }
            }), 400

        audio_file = request.files['audio']
        filename = audio_file.filename or 'unknown'

        if not filename:
            logger.error('Empty filename provided')
            return jsonify({
                'success': False,
                'error': {
                    'code': 'INVALID_FILENAME',
                    'message': 'Filename cannot be empty'
                }
            }), 400

        try:
            # Read audio bytes
            audio_bytes = audio_file.read()

            if not audio_bytes:
                logger.error('Empty audio file')
                return jsonify({
                    'success': False,
                    'error': {
                        'code': 'EMPTY_FILE',
                        'message': 'Audio file is empty'
                    }
                }), 400

            logger.info(f'Processing audio file: {filename} (size: {len(audio_bytes)} bytes)')

            # Quality check
            quality_result = quality_checker.check(audio_bytes, filename)

            if not quality_result['valid']:
                logger.warning(f'Quality check failed: {quality_result["reason"]}')
                return jsonify({
                    'success': False,
                    'error': {
                        'code': 'QUALITY_CHECK_FAILED',
                        'message': quality_result['reason']
                    }
                }), 400

            # Extract features
            audio_array = quality_result['audio_array']
            sample_rate = quality_result['sample_rate']

            logger.info(f'Extracting features for {quality_result["duration_seconds"]:.1f}s audio')

            features = feature_extractor.extract(audio_array, sample_rate)

            # Clear audio from memory
            del audio_array
            del audio_bytes

            # Compute processing time
            processing_time_ms = int((time.time() - start_time) * 1000)

            logger.info(f'Feature extraction completed in {processing_time_ms}ms')

            # Return success response
            return jsonify({
                'success': True,
                'features': features,
                'meta': {
                    'duration': quality_result['duration_seconds'],
                    'quality_score': quality_result['quality_score'],
                    'voiced_fraction': quality_result['voiced_fraction'],
                    'snr_estimate': quality_result['snr_estimate'],
                    'processing_time_ms': processing_time_ms
                }
            }), 200

        except Exception as e:
            logger.error(f'Unexpected error during extraction: {str(e)}', exc_info=True)
            return jsonify({
                'success': False,
                'error': {
                    'code': 'EXTRACTION_ERROR',
                    'message': 'Internal server error during feature extraction'
                }
            }), 500

    @app.route('/fallback', methods=['POST'])
    @require_internal_auth
    def fallback_extraction():
        """
        Extract features and generate fallback psychological scores.
        Used when primary ML inference is unavailable.

        Expected request:
        - Content-Type: multipart/form-data
        - Field: 'audio' (file upload)
        - Header: X-VocoCore-Internal-Key (internal auth)

        Returns:
        - 200: { success: true, features: {...}, fallback_scores: {...}, meta: {...} }
        - 400: { success: false, error: {...} }
        - 500: { success: false, error: {...} }
        """
        start_time = time.time()

        # Validate request
        if 'audio' not in request.files:
            logger.error('Missing audio file in fallback request')
            return jsonify({
                'success': False,
                'error': {
                    'code': 'MISSING_AUDIO',
                    'message': 'No audio file provided'
                }
            }), 400

        audio_file = request.files['audio']
        filename = audio_file.filename or 'unknown'

        if not filename:
            logger.error('Empty filename in fallback request')
            return jsonify({
                'success': False,
                'error': {
                    'code': 'INVALID_FILENAME',
                    'message': 'Filename cannot be empty'
                }
            }), 400

        try:
            # Read audio bytes
            audio_bytes = audio_file.read()

            if not audio_bytes:
                logger.error('Empty audio file in fallback request')
                return jsonify({
                    'success': False,
                    'error': {
                        'code': 'EMPTY_FILE',
                        'message': 'Audio file is empty'
                    }
                }), 400

            logger.info(f'Processing fallback request: {filename} (size: {len(audio_bytes)} bytes)')

            # Quality check
            quality_result = quality_checker.check(audio_bytes, filename)

            if not quality_result['valid']:
                logger.warning(f'Quality check failed in fallback: {quality_result["reason"]}')
                return jsonify({
                    'success': False,
                    'error': {
                        'code': 'QUALITY_CHECK_FAILED',
                        'message': quality_result['reason']
                    }
                }), 400

            # Extract features
            audio_array = quality_result['audio_array']
            sample_rate = quality_result['sample_rate']

            logger.info(f'Extracting features for fallback (duration: {quality_result["duration_seconds"]:.1f}s)')

            features = feature_extractor.extract(audio_array, sample_rate)

            # Generate fallback scores
            logger.info('Computing deterministic fallback scores')
            fallback_scores = fallback_scorer.score(features)

            # Clear audio from memory
            del audio_array
            del audio_bytes

            # Compute processing time
            processing_time_ms = int((time.time() - start_time) * 1000)

            logger.info(f'Fallback processing completed in {processing_time_ms}ms')

            # Return success response
            return jsonify({
                'success': True,
                'features': features,
                'fallback_scores': fallback_scores,
                'meta': {
                    'duration': quality_result['duration_seconds'],
                    'quality_score': quality_result['quality_score'],
                    'voiced_fraction': quality_result['voiced_fraction'],
                    'snr_estimate': quality_result['snr_estimate'],
                    'processing_time_ms': processing_time_ms,
                    'is_fallback': True
                }
            }), 200

        except Exception as e:
            logger.error(f'Unexpected error during fallback extraction: {str(e)}', exc_info=True)
            return jsonify({
                'success': False,
                'error': {
                    'code': 'EXTRACTION_ERROR',
                    'message': 'Internal server error during fallback extraction'
                }
            }), 500

    # ========== AUTO-RETRAIN SCHEDULER ==========

    # Start background APScheduler so the model keeps improving itself.
    # Interval is controlled by RETRAIN_INTERVAL_DAYS env var (default 7 days).
    # Set AUTO_RETRAIN_ENABLED=false to disable.
    start_scheduler()

    # Stop the scheduler cleanly when the app shuts down
    import atexit
    atexit.register(stop_scheduler)

    # ========== ERROR HANDLERS ==========

    @app.errorhandler(400)
    def bad_request(error):
        """Handle 400 Bad Request."""
        logger.warning(f'Bad request: {str(error)}')
        return jsonify({
            'success': False,
            'error': {
                'code': 'BAD_REQUEST',
                'message': 'Invalid request format'
            }
        }), 400

    @app.errorhandler(500)
    def internal_error(error):
        """Handle 500 Internal Server Error."""
        logger.error(f'Internal server error: {str(error)}', exc_info=True)
        return jsonify({
            'success': False,
            'error': {
                'code': 'INTERNAL_ERROR',
                'message': 'Internal server error'
            }
        }), 500

    return app


# Application factory pattern for gunicorn
app = create_app()


if __name__ == '__main__':
    # Development server
    app.run(host='0.0.0.0', port=5000, debug=False)
