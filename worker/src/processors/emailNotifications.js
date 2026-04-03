/**
 * emailNotifications processor — Vocalysis Worker
 *
 * Uses Resend (same as the API's emailService) as primary sender.
 * Falls back to SMTP/nodemailer if RESEND_API_KEY is not set.
 */

const logger = require('../logger');

/* ─── Resend sender ─────────────────────────────────────────────────────── */
async function sendViaResend(to, subject, html) {
  const { Resend } = require('resend');
  const resend = new Resend(process.env.RESEND_API_KEY);
  const from = process.env.RESEND_FROM_EMAIL || process.env.EMAIL_FROM || 'info@cittaa.in';
  const { error } = await resend.emails.send({ from, to, subject, html });
  if (error) throw new Error(`Resend error: ${error.message}`);
}

/* ─── SMTP fallback ─────────────────────────────────────────────────────── */
async function sendViaSMTP(to, subject, html) {
  const nodemailer = require('nodemailer');
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      // Support both env var naming conventions
      pass: process.env.SMTP_PASS || process.env.SMTP_PASSWORD,
    },
  });
  const from = process.env.EMAIL_FROM || process.env.SMTP_USER || 'noreply@cittaa.in';
  const info = await transporter.sendMail({ from, to, subject, html });
  return info.messageId;
}

/* ─── HTML templates ─────────────────────────────────────────────────────── */
const emailTemplates = {
  assessment_invite: {
    subject: 'Invitation to Wellness Assessment',
    getBody: (d) => `<p>Dear ${d.employeeName || 'Team Member'},</p>
      <p>You are invited to a wellness assessment on the Vocalysis platform.</p>
      <ul><li>Duration: 5–10 minutes</li><li>Confidential & encrypted</li></ul>
      <p><a href="${d.assessmentLink || '#'}">Start Assessment →</a></p>
      <p>Best regards,<br>Vocalysis Wellness Team</p>`,
  },
  alert_notification: {
    subject: '[ALERT] Wellness Assessment Result',
    getBody: (d) => `<p>Dear ${d.clinicianName || 'Healthcare Provider'},</p>
      <p>An assessment has been completed with notable findings.</p>
      <ul>
        <li>Employee: ${d.employeeName || 'Unknown'}</li>
        <li>Severity: <strong>${(d.severity || '').toUpperCase()}</strong></li>
        <li>Session ID: ${d.sessionId || 'N/A'}</li>
        <li>Time: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</li>
      </ul>
      <p><a href="${d.reviewLink || '#'}">Review Assessment →</a></p>`,
  },
  member_activity: {
    subject: '✅ Member Activity — Assessment Completed',
    getBody: (d) => `<p>Hi,</p>
      <p>A member just completed an assessment on Vocalysis:</p>
      <ul>
        <li><strong>Tenant:</strong> ${d.tenantName || d.tenantId || 'Unknown'}</li>
        <li><strong>Assessment ID:</strong> ${d.sessionId}</li>
        <li><strong>Wellness Score:</strong> ${d.wellnessScore ?? 'N/A'}</li>
        <li><strong>Risk Level:</strong> ${d.riskLevel || 'N/A'}</li>
        <li><strong>Time (IST):</strong> ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</li>
      </ul>
      <p><a href="${d.dashboardLink || 'https://vocalysis.cittaa.in/cittaa-admin'}">View Admin Dashboard →</a></p>
      <p>— Vocalysis Platform</p>`,
  },
  welcome_email: {
    subject: 'Welcome to Vocalysis Platform',
    getBody: (d) => `<p>Dear ${d.userName || 'User'},</p>
      <p>Welcome to Vocalysis Platform — your wellness intelligence hub.</p>
      <p><a href="${d.loginLink || '#'}">Login to Your Account →</a></p>
      <p>Best regards,<br>Vocalysis Team</p>`,
  },
  password_reset: {
    subject: 'Password Reset Request',
    getBody: (d) => `<p>Dear ${d.userName || 'User'},</p>
      <p>Click below to reset your password (expires in 1 hour):</p>
      <p><a href="${d.resetLink || '#'}">Reset Password →</a></p>
      <p>If you did not request this, ignore this email.</p>`,
  },
  weekly_hr_report: {
    subject: 'Weekly Wellness Report',
    getBody: (d) => `<p>Dear ${d.hrAdminName || 'HR Administrator'},</p>
      <p>Weekly wellness summary:</p>
      <ul>
        <li>Total Employees: ${d.totalEmployees || 0}</li>
        <li>Assessed This Week: ${d.assessedThisWeek || 0}</li>
        <li>Normal: ${d.normalCount || 0} | Medium Risk: ${d.mediumRiskCount || 0} | High Risk: ${d.highRiskCount || 0} | Critical: ${d.criticalCount || 0}</li>
      </ul>
      <p><a href="${d.dashboardLink || '#'}">View Full Dashboard →</a></p>`,
  },
  consultation_reminder: {
    subject: 'Upcoming Consultation Reminder',
    getBody: (d) => `<p>Dear ${d.recipientName || 'User'},</p>
      <p>Reminder: you have an upcoming consultation.</p>
      <ul>
        <li>Scheduled: ${d.scheduledTime || 'TBD'}</li>
        <li>With: ${d.otherPartyName || 'Healthcare Provider'}</li>
      </ul>
      <p><a href="${d.joinLink || '#'}">Join →</a></p>`,
  },
  consultation_invite: {
    subject: 'Consultation Invitation',
    getBody: (d) => `<p>Dear ${d.employeeName || 'Team Member'},</p>
      <p>You have been invited to a consultation with ${d.clinicianName || 'Healthcare Provider'}.</p>
      <p>Scheduled: ${d.scheduledDate || 'TBD'}</p>
      <p><a href="${d.consultationLink || '#'}">View Details →</a></p>`,
  },
};

function hashEmail(email) {
  if (!email) return 'unknown';
  const [local, domain] = email.split('@');
  return `${local.substring(0, 2)}${'*'.repeat(Math.max(0, local.length - 2))}@${domain}`;
}

/* ─── Main processor ────────────────────────────────────────────────────── */
module.exports = async function emailNotificationsProcessor(job) {
  const { type, to, templateData } = job.data;
  const attempts = job.attemptsMade || 0;

  logger.info('Processing email (type: %s, attempt: %d) → %s', type, attempts + 1, hashEmail(to));
  job.progress(20);

  if (!emailTemplates[type]) throw new Error(`Unknown email template type: ${type}`);
  if (!to || !to.includes('@')) throw new Error(`Invalid recipient: ${to}`);

  const template = emailTemplates[type];
  job.progress(50);

  const subject = template.subject;
  const html    = `<!DOCTYPE html><html><body style="font-family:sans-serif;color:#1e1b4b;padding:24px">
    ${template.getBody(templateData)}
  </body></html>`;

  let messageId;
  if (process.env.RESEND_API_KEY) {
    await sendViaResend(to, subject, html);
    messageId = 'resend-' + Date.now();
  } else {
    messageId = await sendViaSMTP(to, subject, html);
  }

  job.progress(100);
  logger.info('Email sent (type: %s, id: %s) → %s', type, messageId, hashEmail(to));
  return { type, to: hashEmail(to), messageId, status: 'success', timestamp: new Date() };
};
