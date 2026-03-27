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
        - Field: 'audio' (file upload)
        - Header: X-VocoCore-Internal-Key

        Returns:
        - 200: { success: true, features, scores, meta }
        - 400/500: error response
        """
        start_time = time.time()

        if 'audio' not in request.files:
            return jsonify({'success': False, 'error': {
                'code': 'MISSING_AUDIO', 'message': 'No audio file provided'
            }}), 400

        audio_file = request.files['audio']
        filename = audio_file.filename or 'unknown'

        try:
            audio_bytes = audio_file.read()
            if not audio_bytes:
                return jsonify({'success': False, 'error': {
                    'code': 'EMPTY_FILE', 'message': 'Audio file is empty'
                }}), 400

            logger.info(f'Score request: {filename} ({len(audio_bytes)} bytes)')

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
            del audio_array, audio_bytes

            # ML inference (primary)
            if ml_scorer.is_loaded:
                try:
                    scores = ml_scorer.score(features)
                    scorer_used = 'ml_ensemble_v2'
                    logger.info(
                        f"ML score: {scores['ml_class']} "
                        f"(conf={scores['ml_confidence']:.2f})"
                    )
                except Exception as ml_err:
                    logger.warning(f"ML scorer failed ({ml_err}), using fallback")
                    scores = fallback_scorer.score(features)
                    scores['is_ml_scored'] = False
                    scorer_used = 'deterministic_fallback'
            else:
                scores = fallback_scorer.score(features)
                scores['is_ml_scored'] = False
                scorer_used = 'deterministic_fallback'

            processing_time_ms = int((time.time() - start_time) * 1000)
            logger.info(f'Score completed in {processing_time_ms}ms via {scorer_used}')

            return jsonify({
                'success': True,
                'features': features,
                'scores': scores,
                'meta': {
                    'duration':          quality_result['duration_seconds'],
                    'quality_score':     quality_result['quality_score'],
                    'voiced_fraction':   quality_result['voiced_fraction'],
                    'snr_estimate':      quality_result['snr_estimate'],
                    'processing_time_ms': processing_time_ms,
                    'scorer_used':       scorer_used,
                    'calibration':       'Indian voices — Hindi/Telugu/Tamil/Kannada/IndEng',
                }
            }), 200

        except Exception as e:
            logger.error(f'Unexpected error in /score: {e}', exc_info=True)
            return jsonify({'success': False, 'error': {
                'code': 'SCORE_ERROR',
                'message': 'Internal server error during scoring'
            }}), 500

    @app.route('/retrain', methods=['POST'])
    @require_internal_auth
    def retrain():
        """
        Trigger ElevenLabs-based model retraining in the background.

        Uses ELEVENLABS_API_KEY from environment (set in Railway).
        Generates Indian voice samples → extracts features → fine-tunes model → hot-swaps scorer.

        Returns immediately with job status. Poll /retrain/status for progress.
        """
        api_key = os.environ.get('ELEVENLABS_API_KEY')
        if not api_key:
            return jsonify({'success': False, 'error': {
                'code': 'NO_API_KEY',
                'message': 'ELEVENLABS_API_KEY not set in environment'
            }}), 400

        started, message = start_retrain(api_key)
        if not started:
            return jsonify({'success': False, 'error': {
                'code': 'ALREADY_RUNNING',
                'message': message
            }}), 409

        return jsonify({
            'success': True,
            'message': message,
            'note': 'Poll /retrain/status for progress. Takes ~10-15 minutes on first run.',
        }), 202

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
