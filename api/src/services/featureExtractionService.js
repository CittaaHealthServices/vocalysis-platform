const axios = require('axios');
const FormData = require('form-data');
const logger = require('../utils/logger');

class FeatureExtractionService {
  /**
   * Extract acoustic features from audio buffer
   */
  async extract(audioBuffer, filename) {
    try {
      const form = new FormData();
      form.append('audio', audioBuffer, { filename });

      const response = await axios.post(
        `${process.env.VOCOCORE_SERVICE_URL}/extract`,
        form,
        {
          headers: {
            ...form.getHeaders(),
            'X-VocoCore-Internal-Key': process.env.VOCOCORE_INTERNAL_KEY
          },
          timeout: 120000
        }
      );

      if (!response.data || typeof response.data !== 'object') {
        throw new Error('Invalid response format from feature extraction service');
      }

      return response.data;
    } catch (err) {
      if (err.response) {
        logger.error('Feature extraction service error', {
          status: err.response.status,
          statusText: err.response.statusText,
          message: err.response.data?.message || err.message
        });
        throw new Error(`Feature extraction failed: ${err.response.status} ${err.response.statusText}`);
      }

      logger.error('Feature extraction request failed', {
        error: err.message
      });
      throw new Error('Failed to extract acoustic features from audio');
    }
  }

  /**
   * Validate audio buffer before sending to extraction service
   */
  validateAudioBuffer(buffer, expectedMimeType = 'audio/wav') {
    if (!Buffer.isBuffer(buffer)) {
      throw new Error('Invalid audio buffer');
    }

    if (buffer.length === 0) {
      throw new Error('Empty audio buffer');
    }

    if (buffer.length > 50 * 1024 * 1024) { // 50MB max
      throw new Error('Audio file too large (max 50MB)');
    }

    return true;
  }
}

module.exports = new FeatureExtractionService();
