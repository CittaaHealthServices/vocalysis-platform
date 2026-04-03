const nodemailer = require('nodemailer');
const logger = require('../logger');

// Email templates
const emailTemplates = {
  assessment_invite: {
    subject: 'Invitation to Wellness Assessment',
    getBody: (data) => `
      <h2>Wellness Assessment Invitation</h2>
      <p>Dear ${data.employeeName || 'Team Member'},</p>
      <p>You are invited to participate in a wellness assessment as part of the Vocalysis platform initiative.</p>
      <p><strong>Assessment Details:</strong></p>
      <ul>
        <li>Duration: 5-10 minutes</li>
        <li>Type: Voice and wellness analysis</li>
        <li>Confidential: Your data is encrypted and secure</li>
      </ul>
      <p><a href="${data.assessmentLink || '#'}">Start Assessment</a></p>
      <p>If you have any questions, please contact your HR department or healthcare provider.</p>
      <p>Best regards,<br>Vocalysis Wellness Team</p>
    `
  },
  alert_notification: {
    subject: '[ALERT] Wellness Assessment Result Notification',
    getBody: (data) => `
      <h2>Assessment Result Alert</h2>
      <p>Dear ${data.clinicianName || 'Healthcare Provider'},</p>
      <p>An assessment has been completed with notable findings.</p>
      <p><strong>Assessment Information:</strong></p>
      <ul>
        <li>Employee: ${data.employeeName || 'Unknown'}</li>
        <li>Severity Level: <span style="color: ${getSeverityColor(data.severity)}">${data.severity.toUpperCase()}</span></li>
        <li>Assessment ID: ${data.sessionId || 'N/A'}</li>
        <li>Timestamp: ${new Date().toLocaleString()}</li>
      </ul>
      <p><strong>Alert Message:</strong> ${data.message || 'No additional details'}</p>
      <p>Please review this assessment and take appropriate action.</p>
      <p><a href="${data.reviewLink || '#'}">Review Assessment</a></p>
      <p>Best regards,<br>Vocalysis Alert System</p>
    `
  },
  consultation_invite: {
    subject: 'Consultation Invitation',
    getBody: (data) => `
      <h2>Consultation Invitation</h2>
      <p>Dear ${data.employeeName || 'Team Member'},</p>
      <p>You have been invited to a consultation session.</p>
      <p><strong>Consultation Details:</strong></p>
      <ul>
        <li>Clinician: ${data.clinicianName || 'Healthcare Provider'}</li>
        <li>Scheduled Date: ${data.scheduledDate || 'TBD'}</li>
        <li>Duration: ${data.duration || '30 minutes'}</li>
      </ul>
      <p><a href="${data.consultationLink || '#'}">View Consultation Details</a></p>
      <p>Best regards,<br>Vocalysis Team</p>
    `
  },
  welcome_email: {
    subject: 'Welcome to Vocalysis Platform',
    getBody: (data) => `
      <h2>Welcome to Vocalysis</h2>
      <p>Dear ${data.userName || 'User'},</p>
      <p>Welcome to the Vocalysis Platform 2.0 - Your Wellness Intelligence Hub.</p>
      <p>Your account has been successfully created. You can now:</p>
      <ul>
        <li>Access personalized wellness assessments</li>
        <li>Track your health metrics over time</li>
        <li>Connect with healthcare providers</li>
        <li>Manage your wellness journey</li>
      </ul>
      <p><a href="${data.loginLink || '#'}">Login to Your Account</a></p>
      <p>If you need assistance, contact our support team.</p>
      <p>Best regards,<br>Vocalysis Team</p>
    `
  },
  password_reset: {
    subject: 'Password Reset Request',
    getBody: (data) => `
      <h2>Password Reset</h2>
      <p>Dear ${data.userName || 'User'},</p>
      <p>We received a request to reset your password. Click the link below to create a new password.</p>
      <p><a href="${data.resetLink || '#'}">Reset Your Password</a></p>
      <p>This link expires in 1 hour.</p>
      <p>If you did not request this reset, please ignore this email.</p>
      <p>Best regards,<br>Vocalysis Team</p>
    `
  },
  weekly_hr_report: {
    subject: 'Weekly Wellness Report',
    getBody: (data) => `
      <h2>Weekly Wellness Summary Report</h2>
      <p>Dear ${data.hrAdminName || 'HR Administrator'},</p>
      <p>Here is your weekly wellness summary for the departments you oversee.</p>
      <p><strong>Summary Statistics:</strong></p>
      <ul>
        <li>Total Employees: ${data.totalEmployees || 0}</li>
        <li>Assessed This Week: ${data.assessedThisWeek || 0}</li>
        <li>Wellness Distribution:</li>
        <ul>
          <li>Normal: ${data.normalCount || 0}</li>
          <li>Medium Risk: ${data.mediumRiskCount || 0}</li>
          <li>High Risk: ${data.highRiskCount || 0}</li>
          <li>Critical: ${data.criticalCount || 0}</li>
        </ul>
        <li>Trend vs Last Week: ${data.trend || 'Stable'}</li>
      </ul>
      <p><a href="${data.dashboardLink || '#'}">View Full Dashboard</a></p>
      <p>Best regards,<br>Vocalysis Analytics Team</p>
    `
  },
  consultation_reminder: {
    subject: 'Upcoming Consultation Reminder',
    getBody: (data) => `
      <h2>Consultation Reminder</h2>
      <p>Dear ${data.recipientName || 'User'},</p>
      <p>This is a reminder about your upcoming consultation.</p>
      <p><strong>Consultation Details:</strong></p>
      <ul>
        <li>Scheduled: ${data.scheduledTime || 'TBD'}</li>
        <li>Duration: ${data.duration || '30 minutes'}</li>
        <li>With: ${data.otherPartyName || 'Healthcare Provider'}</li>
      </ul>
      <p><a href="${data.joinLink || '#'}">Join Consultation</a></p>
      <p>If you need to reschedule, please notify us as soon as possible.</p>
      <p>Best regards,<br>Vocalysis Team</p>
    `
  }
};

function getSeverityColor(severity) {
  const colors = {
    critical: '#dc2626',
    high: '#ea580c',
    medium: '#f59e0b',
    low: '#10b981'
  };
  return colors[severity] || '#6b7280';
}

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

// Hash email for logging
function hashEmail(email) {
  if (!email) return 'unknown';
  const parts = email.split('@');
  const localPart = parts[0];
  const domainPart = parts[1];
  const hashedLocal = localPart.substring(0, 2) + '*'.repeat(localPart.length - 2);
  return `${hashedLocal}@${domainPart}`;
}

module.exports = async function emailNotificationsProcessor(job) {
  const { type, to, templateData } = job.data;
  let attempts = job.attemptsMade || 0;
  const maxAttempts = 3;

  try {
    logger.info('Processing email notification (type: %s, attempt: %d) to %s', type, attempts + 1, hashEmail(to));
    job.progress(25);

    // Validate email type
    if (!emailTemplates[type]) {
      throw new Error(`Unknown email template type: ${type}`);
    }

    // Validate recipient
    if (!to || !to.includes('@')) {
      throw new Error(`Invalid recipient email: ${to}`);
    }

    const template = emailTemplates[type];
    job.progress(50);

    // Build HTML body
    const htmlBody = template.getBody(templateData);

    // Send email
    logger.info('Sending email (type: %s) to %s', type, hashEmail(to));
    job.progress(75);

    const transporter = createTransporter();
    const mailOptions = {
      from: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || 'noreply@vocalysis.cittaa.in',
      to: to,
      subject: template.subject,
      html: htmlBody,
      text: templateData.plainText || 'Please view this email in HTML format.',
      replyTo: process.env.SMTP_REPLY_TO || 'support@vocalysis.cittaa.in'
    };

    const info = await transporter.sendMail(mailOptions);

    job.progress(100);
    logger.info('Email sent successfully (type: %s, messageId: %s) to %s', type, info.messageId, hashEmail(to));

    return {
      type,
      to: hashEmail(to),
      messageId: info.messageId,
      status: 'success',
      timestamp: new Date()
    };
  } catch (error) {
    attempts += 1;
    logger.warn(
      'Email notification failed (type: %s, attempt: %d/%d) to %s: %s',
      type,
      attempts,
      maxAttempts,
      hashEmail(to),
      error.message
    );

    if (attempts < maxAttempts) {
      // Retry with 30 second delay
      throw new Error(`Email send failed (attempt ${attempts}): ${error.message}`);
    } else {
      // Log permanent failure
      logger.error(
        'Email notification permanent failure (type: %s, max attempts reached) to %s: %s',
        type,
        hashEmail(to),
        error.message
      );
      throw new Error(`Email notification failed after ${maxAttempts} attempts: ${error.message}`);
    }
  }
};
