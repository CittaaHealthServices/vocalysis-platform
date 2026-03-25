const winston = require('winston');

const SENSITIVE_FIELDS = ['password', 'token', 'key', 'audio', 'secret', 'refreshToken', 'accessToken'];

const sanitizeValue = (value) => {
  if (typeof value !== 'string') {
    return value;
  }
  return '***REDACTED***';
};

const sanitizeObject = (obj, depth = 0, maxDepth = 5) => {
  if (depth > maxDepth) {
    return obj;
  }

  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item, depth + 1, maxDepth));
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_FIELDS.some((field) => lowerKey.includes(field))) {
      sanitized[key] = sanitizeValue(value);
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value, depth + 1, maxDepth);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
};

const customFormat = winston.format.printf(({ timestamp, level, message, ...meta }) => {
  const sanitized = sanitizeObject(meta);
  const metaStr = Object.keys(sanitized).length > 0 ? JSON.stringify(sanitized) : '';
  return `${timestamp} [${level.toUpperCase()}] ${message} ${metaStr}`.trim();
});

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    process.env.NODE_ENV === 'production'
      ? winston.format.json()
      : winston.format.combine(
          winston.format.colorize(),
          customFormat
        )
  ),
  defaultMeta: { service: 'vocalysis-api' },
  transports: [
    new winston.transports.Console({
      format: process.env.NODE_ENV === 'production'
        ? winston.format.json()
        : winston.format.combine(
            winston.format.colorize(),
            customFormat
          ),
    }),
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: winston.format.json(),
      maxsize: 5242880,
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: winston.format.json(),
      maxsize: 5242880,
      maxFiles: 10,
    }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.simple(),
    })
  );
}

module.exports = logger;
