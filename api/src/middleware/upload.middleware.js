const multer = require('multer');
const { fileTypeFromBuffer } = require('file-type');
const logger = require('../config/logger');

const storage = multer.memoryStorage();

const fileFilter = async (req, file, cb) => {
  try {
    if (!file.mimetype.startsWith('audio/') && file.mimetype !== 'application/octet-stream') {
      logger.warn('Invalid audio file mimetype', {
        mimetype: file.mimetype,
        fieldName: file.fieldname,
        tenantId: req.user?.tenantId,
      });

      return cb(
        new Error('Invalid file type. Only audio files are allowed.'),
        false
      );
    }

    if (req.file || (req.files && req.files.length > 0)) {
      const buffer = req.file?.buffer || (req.files?.[0]?.buffer);

      if (buffer) {
        const fileType = await fileTypeFromBuffer(buffer);

        const allowedAudioTypes = [
          'audio/mpeg',
          'audio/wav',
          'audio/webm',
          'audio/ogg',
          'audio/aac',
          'audio/flac',
          'audio/mp4',
          'audio/x-m4a',
        ];

        if (fileType && !allowedAudioTypes.includes(fileType.mime)) {
          logger.warn('Invalid audio file detected', {
            detectedMime: fileType.mime,
            declaredMime: file.mimetype,
            fieldName: file.fieldname,
            tenantId: req.user?.tenantId,
          });

          return cb(
            new Error('Invalid audio format detected. Only standard audio formats are allowed.'),
            false
          );
        }
      }
    }

    cb(null, true);
  } catch (error) {
    logger.error('File filter validation failed', {
      error: error.message,
      fieldName: file.fieldname,
      tenantId: req.user?.tenantId,
    });

    cb(error, false);
  }
};

const audioUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024,
  },
});

module.exports = {
  audioUpload,
};
