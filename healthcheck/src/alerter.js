const nodemailer = require('nodemailer');
const logger = require('./logger');

// In-memory store for debouncing alerts (30 minute window)
const alertDebounceMap = new Map();
const DEBOUNCE_WINDOW_MS = 30 * 60 * 1000; // 30 minutes

// Create email transporter
function createTransporter() {
  const smtpConfig = {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD
    }
  };

  return nodemailer.createTransport(smtpConfig);
}

// Check if alert should be sent based on debounce
function shouldSendAlert(service) {
  const lastAlertTime = alertDebounceMap.get(service);
  const now = Date.now();

  if (!lastAlertTime || now - lastAlertTime > DEBOUNCE_WINDOW_MS) {
    alertDebounceMap.set(service, now);
    return true;
  }

  logger.debug('Alert for service %s debounced (sent within last 30 minutes)', service);
  return false;
}

// Send degradation alert
async function sendDegradationAlert({ service, status, error, responseTime }) {
  if (!shouldSendAlert(`degradation-${service}`)) {
    return false;
  }

  try {
    const alertTo = process.env.ALERT_EMAIL_TO || 'alerts@cittaa.in';

    if (!alertTo) {
      logger.warn('ALERT_EMAIL_TO not configured, skipping alert email');
      return false;
    }

    const transporter = createTransporter();

    const subject = `[VOCALYSIS ALERT] ${service} is ${status}`;
    const statusEmoji = status === 'degraded' ? 'warning' : 'error';
    const statusColor = status === 'degraded' ? '#f59e0b' : '#dc2626';

    const htmlBody = `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; color: #333; }
            .alert-box {
              border-left: 5px solid ${statusColor};
              padding: 15px;
              margin: 20px 0;
              background-color: #f3f4f6;
              border-radius: 4px;
            }
            .alert-title {
              font-size: 18px;
              font-weight: bold;
              color: ${statusColor};
              margin-bottom: 10px;
            }
            .service-status {
              font-size: 14px;
              margin: 8px 0;
              line-height: 1.6;
            }
            .error-message {
              background-color: #fee2e2;
              padding: 10px;
              border-radius: 4px;
              margin-top: 10px;
              font-size: 12px;
              color: #991b1b;
              font-family: monospace;
            }
            .footer {
              margin-top: 20px;
              font-size: 12px;
              color: #6b7280;
              border-top: 1px solid #e5e7eb;
              padding-top: 10px;
            }
            .status-link {
              display: inline-block;
              background-color: #6B21A8;
              color: white;
              padding: 10px 20px;
              text-decoration: none;
              border-radius: 4px;
              margin-top: 10px;
            }
          </style>
        </head>
        <body>
          <div class="alert-box">
            <div class="alert-title">${statusEmoji} Service Alert: ${service}</div>
            <div class="service-status">
              <strong>Service:</strong> ${service}<br>
              <strong>Status:</strong> <span style="color: ${statusColor};">${status.toUpperCase()}</span><br>
              <strong>Response Time:</strong> ${responseTime ? responseTime + 'ms' : 'N/A'}<br>
              <strong>Timestamp:</strong> ${new Date().toLocaleString('en-IN')}
            </div>
            ${error ? `<div class="error-message"><strong>Error:</strong> ${error}</div>` : ''}
            <a href="${process.env.HEALTHCHECK_URL || 'https://status.vocalysis.cittaa.in'}" class="status-link">
              View Status Page
            </a>
          </div>
          <div class="footer">
            <p>This is an automated alert from Vocalysis Health Services. No action is required unless the alert persists.</p>
            <p>Alerts are debounced to prevent notification spam. You will receive at most one alert per service per 30 minutes.</p>
          </div>
        </body>
      </html>
    `;

    const mailOptions = {
      from: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || 'alerts@vocalysis.cittaa.in',
      to: alertTo,
      subject: subject,
      html: htmlBody,
      replyTo: 'support@vocalysis.cittaa.in'
    };

    const info = await transporter.sendMail(mailOptions);

    logger.info('Degradation alert sent for service %s (messageId: %s)', service, info.messageId);
    return true;
  } catch (error) {
    logger.error('Failed to send degradation alert for service %s: %s', service, error.message);
    return false;
  }
}

// Send recovery alert
async function sendRecoveryAlert({ service }) {
  if (!shouldSendAlert(`recovery-${service}`)) {
    return false;
  }

  try {
    const alertTo = process.env.ALERT_EMAIL_TO || 'alerts@cittaa.in';

    if (!alertTo) {
      logger.warn('ALERT_EMAIL_TO not configured, skipping recovery alert');
      return false;
    }

    const transporter = createTransporter();

    const subject = `[VOCALYSIS RECOVERY] ${service} is now healthy`;

    const htmlBody = `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; color: #333; }
            .recovery-box {
              border-left: 5px solid #10b981;
              padding: 15px;
              margin: 20px 0;
              background-color: #f0fdf4;
              border-radius: 4px;
            }
            .recovery-title {
              font-size: 18px;
              font-weight: bold;
              color: #10b981;
              margin-bottom: 10px;
            }
            .service-status {
              font-size: 14px;
              margin: 8px 0;
              line-height: 1.6;
            }
            .footer {
              margin-top: 20px;
              font-size: 12px;
              color: #6b7280;
              border-top: 1px solid #e5e7eb;
              padding-top: 10px;
            }
          </style>
        </head>
        <body>
          <div class="recovery-box">
            <div class="recovery-title">✓ Service Recovery: ${service}</div>
            <div class="service-status">
              <strong>Service:</strong> ${service}<br>
              <strong>Status:</strong> <span style="color: #10b981;">HEALTHY</span><br>
              <strong>Recovered At:</strong> ${new Date().toLocaleString('en-IN')}
            </div>
          </div>
          <div class="footer">
            <p>The service that was previously experiencing issues has recovered and is now operating normally.</p>
          </div>
        </body>
      </html>
    `;

    const mailOptions = {
      from: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || 'alerts@vocalysis.cittaa.in',
      to: alertTo,
      subject: subject,
      html: htmlBody,
      replyTo: 'support@vocalysis.cittaa.in'
    };

    const info = await transporter.sendMail(mailOptions);

    logger.info('Recovery alert sent for service %s (messageId: %s)', service, info.messageId);
    return true;
  } catch (error) {
    logger.error('Failed to send recovery alert for service %s: %s', service, error.message);
    return false;
  }
}

module.exports = {
  sendDegradationAlert,
  sendRecoveryAlert
};
