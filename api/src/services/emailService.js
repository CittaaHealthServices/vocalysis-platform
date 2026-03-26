/**
 * EmailService — Vocalysis Platform
 * Beautiful transactional emails powered by Resend
 */
const { Resend } = require('resend');
const logger = require('../utils/logger');

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL  = process.env.RESEND_FROM_EMAIL || 'info@cittaa.in';
const BRAND_NAME  = 'Cittaa Health Services';
const BRAND_COLOR = '#7c3aed';  // violet-700
const PLATFORM_URL = process.env.PLATFORM_URL || 'https://striking-bravery-production-c13e.up.railway.app';

/* ─────────────────────────────────────────────────────────────────────────── *
 * Shared CSS                                                                   *
 * ─────────────────────────────────────────────────────────────────────────── */
const BASE_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: #f5f3ff;
    color: #1e1b2e;
    -webkit-font-smoothing: antialiased;
  }
  .wrapper {
    max-width: 600px;
    margin: 40px auto;
    background: #ffffff;
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 4px 40px rgba(124,58,237,0.10);
  }
  .header {
    background: linear-gradient(135deg, #4c1d95 0%, #7c3aed 60%, #a855f7 100%);
    padding: 40px 48px 36px;
    text-align: left;
  }
  .logo-badge {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 28px;
  }
  .logo-icon {
    width: 36px; height: 36px;
    background: rgba(255,255,255,0.2);
    border: 1px solid rgba(255,255,255,0.3);
    border-radius: 10px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-weight: 900;
    font-size: 18px;
    color: #fff;
    line-height: 1;
    text-align: center;
    vertical-align: middle;
    padding: 6px;
  }
  .logo-text {
    font-size: 15px;
    font-weight: 700;
    color: rgba(255,255,255,0.95);
    letter-spacing: -0.2px;
  }
  .header h1 {
    font-size: 26px;
    font-weight: 700;
    color: #ffffff;
    letter-spacing: -0.5px;
    line-height: 1.25;
  }
  .header p {
    margin-top: 8px;
    font-size: 15px;
    color: rgba(255,255,255,0.7);
  }
  .body {
    padding: 40px 48px;
  }
  .greeting {
    font-size: 16px;
    color: #374151;
    margin-bottom: 16px;
    line-height: 1.6;
  }
  .card {
    background: #f9f7ff;
    border: 1px solid #e5e0f9;
    border-radius: 12px;
    padding: 24px;
    margin: 24px 0;
  }
  .card-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 0;
    border-bottom: 1px solid #ede9fe;
    font-size: 14px;
  }
  .card-row:last-child { border-bottom: none; }
  .card-row .label { color: #6b7280; font-weight: 500; }
  .card-row .value { color: #1e1b2e; font-weight: 600; }
  .btn {
    display: inline-block;
    background: linear-gradient(135deg, #7c3aed, #6d28d9);
    color: #ffffff !important;
    text-decoration: none;
    font-size: 15px;
    font-weight: 600;
    padding: 14px 32px;
    border-radius: 10px;
    margin: 8px 0;
    letter-spacing: -0.1px;
  }
  .btn-outline {
    display: inline-block;
    background: transparent;
    color: #7c3aed !important;
    text-decoration: none;
    font-size: 14px;
    font-weight: 600;
    padding: 12px 28px;
    border-radius: 10px;
    border: 1.5px solid #7c3aed;
    margin: 8px 0;
  }
  .btn-center { text-align: center; margin: 32px 0; }
  .alert-banner {
    border-radius: 10px;
    padding: 16px 20px;
    margin: 24px 0;
    font-size: 14px;
    line-height: 1.6;
  }
  .alert-warning {
    background: #fffbeb;
    border-left: 4px solid #f59e0b;
    color: #92400e;
  }
  .alert-danger {
    background: #fff1f2;
    border-left: 4px solid #ef4444;
    color: #991b1b;
  }
  .alert-info {
    background: #f0f9ff;
    border-left: 4px solid #0ea5e9;
    color: #0c4a6e;
  }
  .stat-grid {
    display: flex;
    gap: 16px;
    margin: 24px 0;
  }
  .stat-box {
    flex: 1;
    background: #f9f7ff;
    border: 1px solid #ede9fe;
    border-radius: 12px;
    padding: 20px 16px;
    text-align: center;
  }
  .stat-value {
    font-size: 28px;
    font-weight: 700;
    color: #7c3aed;
    letter-spacing: -1px;
  }
  .stat-label {
    font-size: 12px;
    color: #9ca3af;
    margin-top: 4px;
    font-weight: 500;
  }
  .divider {
    height: 1px;
    background: #f3f4f6;
    margin: 32px 0;
  }
  .tag {
    display: inline-block;
    padding: 4px 10px;
    border-radius: 99px;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.2px;
  }
  .tag-critical { background: #fee2e2; color: #991b1b; }
  .tag-high     { background: #ffedd5; color: #9a3412; }
  .tag-medium   { background: #fef9c3; color: #854d0e; }
  .tag-low      { background: #dcfce7; color: #166534; }
  .footer {
    background: #faf5ff;
    border-top: 1px solid #f3f0ff;
    padding: 28px 48px;
    text-align: center;
  }
  .footer p { font-size: 12px; color: #9ca3af; line-height: 1.8; }
  .footer a { color: #7c3aed; text-decoration: none; }
  .footer .brand { font-weight: 700; color: #6b21a8; }
`;

/* ─────────────────────────────────────────────────────────────────────────── *
 * Shared header / footer fragments                                             *
 * ─────────────────────────────────────────────────────────────────────────── */
function htmlHeader(title, subtitle = '') {
  return `
  <div class="header">
    <div class="logo-badge">
      <span class="logo-icon">V</span>
      <span class="logo-text">Vocalysis &nbsp;·&nbsp; ${BRAND_NAME}</span>
    </div>
    <h1>${title}</h1>
    ${subtitle ? `<p>${subtitle}</p>` : ''}
  </div>`;
}

function htmlFooter() {
  return `
  <div class="footer">
    <p>
      Powered by <span class="brand">VocaCore™</span> &nbsp;|&nbsp; <span class="brand">${BRAND_NAME}</span>
    </p>
    <p style="margin-top:6px;">
      This is an automated message from the Vocalysis Platform.
      &nbsp;<a href="${PLATFORM_URL}">Visit Platform</a>
    </p>
    <p style="margin-top:6px; font-size:11px; color:#d1d5db;">
      © ${new Date().getFullYear()} ${BRAND_NAME}. All rights reserved.
    </p>
  </div>`;
}

function wrapHtml(inner) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${BASE_STYLES}</style>
</head>
<body>
  <div class="wrapper">
    ${inner}
  </div>
</body>
</html>`;
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * Core send helper                                                             *
 * ─────────────────────────────────────────────────────────────────────────── */
async function sendEmail({ to, subject, html, text }) {
  try {
    const { data, error } = await resend.emails.send({
      from:    FROM_EMAIL,
      to:      Array.isArray(to) ? to : [to],
      subject,
      html,
      text:    text || subject,
    });

    if (error) {
      logger.error('Resend email error', { error, to, subject });
      throw new Error(error.message || 'Email send failed');
    }

    logger.debug('Email sent via Resend', { id: data?.id, to, subject });
    return { success: true, id: data?.id };
  } catch (err) {
    logger.error('Failed to send email', { error: err.message, to, subject });
    throw err;
  }
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * WELCOME EMAIL                                                                *
 * ─────────────────────────────────────────────────────────────────────────── */
async function sendWelcomeEmail({ to, name, loginUrl, tempPassword, companyName }) {
  const subject = `Welcome to Vocalysis — ${companyName}`;

  const html = wrapHtml(`
    ${htmlHeader('Welcome aboard, ' + name + '!', 'Your account is ready. Let\'s get started.')}
    <div class="body">
      <p class="greeting">
        Hi <strong>${name}</strong>, you've been added to <strong>${companyName}</strong>'s wellness platform,
        powered by Vocalysis. Your account is all set up and ready to go.
      </p>

      <div class="card">
        <div class="card-row">
          <span class="label">Email address</span>
          <span class="value">${to}</span>
        </div>
        <div class="card-row">
          <span class="label">Temporary password</span>
          <span class="value" style="font-family:monospace; letter-spacing:1px;">${tempPassword}</span>
        </div>
        <div class="card-row">
          <span class="label">Organisation</span>
          <span class="value">${companyName}</span>
        </div>
      </div>

      <div class="alert-banner alert-warning">
        <strong>Action required:</strong> Please log in and change your password immediately.
        Your temporary password will expire in 24 hours.
      </div>

      <div class="btn-center">
        <a href="${loginUrl}" class="btn">Sign In to Vocalysis →</a>
      </div>

      <div class="divider"></div>
      <p style="font-size:14px; color:#6b7280; line-height:1.7;">
        Once you're in, you can complete your profile, update your notification preferences, and begin your first wellness check-in.
        If you have any questions, contact your administrator or HR team.
      </p>
    </div>
    ${htmlFooter()}
  `);

  return sendEmail({ to, subject, html, text: `Welcome to Vocalysis!\n\nEmail: ${to}\nTemp Password: ${tempPassword}\nLogin: ${loginUrl}` });
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * ASSESSMENT INVITATION                                                        *
 * ─────────────────────────────────────────────────────────────────────────── */
async function sendAssessmentInvite({ employee, clinicianName, assessmentUrl, scheduledAt }) {
  const subject = `You've been invited to a wellness assessment`;
  const scheduledDate = new Date(scheduledAt).toLocaleString('en-IN', {
    dateStyle: 'long', timeStyle: 'short', timeZone: 'Asia/Kolkata'
  });

  const html = wrapHtml(`
    ${htmlHeader('Wellness Assessment Invitation', `Requested by ${clinicianName}`)}
    <div class="body">
      <p class="greeting">Hi <strong>${employee.firstName}</strong>,</p>
      <p style="font-size:15px; color:#374151; line-height:1.7; margin-bottom:20px;">
        <strong>${clinicianName}</strong> has invited you to complete a VocaCore™ voice wellness assessment.
        This takes just 5–10 minutes and provides personalised insights about your emotional wellbeing.
      </p>

      <div class="card">
        <div class="card-row">
          <span class="label">Scheduled for</span>
          <span class="value">${scheduledDate} IST</span>
        </div>
        <div class="card-row">
          <span class="label">Duration</span>
          <span class="value">5 – 10 minutes</span>
        </div>
        <div class="card-row">
          <span class="label">Type</span>
          <span class="value">Voice biomarker analysis</span>
        </div>
      </div>

      <div class="alert-banner alert-info">
        <strong>Tips for best results:</strong> Find a quiet space, ensure your microphone works, and speak naturally for 30 seconds to 2 minutes when prompted.
      </div>

      <div class="btn-center">
        <a href="${assessmentUrl}" class="btn">Start Assessment →</a>
      </div>
    </div>
    ${htmlFooter()}
  `);

  return sendEmail({
    to: employee.email, subject, html,
    text: `Assessment Invitation from ${clinicianName}\nScheduled: ${scheduledDate}\nLink: ${assessmentUrl}`
  });
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * ALERT NOTIFICATION                                                           *
 * ─────────────────────────────────────────────────────────────────────────── */
async function sendAlertNotification({ to, alert, employee, tenantName }) {
  const level = alert.alertLevel || 'high';
  const isCritical = level === 'critical';
  const subject = `[${level.toUpperCase()}] Wellness Alert — ${employee.firstName} ${employee.lastName}`;

  const headerBg = isCritical
    ? 'linear-gradient(135deg, #7f1d1d 0%, #dc2626 100%)'
    : 'linear-gradient(135deg, #78350f 0%, #d97706 100%)';

  const html = wrapHtml(`
    <div class="header" style="background: ${headerBg};">
      <div class="logo-badge">
        <span class="logo-icon">V</span>
        <span class="logo-text">Vocalysis &nbsp;·&nbsp; ${BRAND_NAME}</span>
      </div>
      <h1>${isCritical ? 'Critical Alert' : 'High-Priority Alert'}</h1>
      <p>Immediate attention may be required</p>
    </div>
    <div class="body">
      <p class="greeting">A wellness alert has been triggered in <strong>${tenantName}</strong>.</p>

      <div class="card">
        <div class="card-row">
          <span class="label">Employee</span>
          <span class="value">${employee.firstName} ${employee.lastName}</span>
        </div>
        <div class="card-row">
          <span class="label">Alert level</span>
          <span class="value">
            <span class="tag tag-${level}">${level.toUpperCase()}</span>
          </span>
        </div>
        ${(alert.triggeringScores || []).length > 0 ? `
        <div class="card-row" style="flex-direction:column; align-items:flex-start; gap:8px;">
          <span class="label">Triggering indicators</span>
          <span class="value">${(alert.triggeringScores || []).join(' · ')}</span>
        </div>` : ''}
      </div>

      <div class="alert-banner ${isCritical ? 'alert-danger' : 'alert-warning'}">
        <strong>Action needed:</strong> Review the full assessment and consider scheduling a follow-up consultation.
        Handle this information with appropriate confidentiality.
      </div>

      <div class="btn-center">
        <a href="${PLATFORM_URL}/alerts/${alert._id}" class="btn">Review Alert →</a>
      </div>
    </div>
    ${htmlFooter()}
  `);

  return sendEmail({
    to, subject, html,
    text: `[${level.toUpperCase()}] Alert for ${employee.firstName} ${employee.lastName}\n${PLATFORM_URL}/alerts/${alert._id}`
  });
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * CONSULTATION INVITE                                                          *
 * ─────────────────────────────────────────────────────────────────────────── */
async function sendConsultationInvite({ to, consultation, meetLink, calendarLink }) {
  const subject = 'Your wellness consultation has been scheduled';
  const consultationTime = new Date(consultation.scheduledAt).toLocaleString('en-IN', {
    dateStyle: 'full', timeStyle: 'short', timeZone: 'Asia/Kolkata'
  });

  const html = wrapHtml(`
    ${htmlHeader('Consultation Scheduled', 'Your session is confirmed')}
    <div class="body">
      <p class="greeting">Your wellness consultation has been booked. Here are the details:</p>

      <div class="card">
        <div class="card-row">
          <span class="label">Date & time</span>
          <span class="value">${consultationTime} IST</span>
        </div>
        <div class="card-row">
          <span class="label">Duration</span>
          <span class="value">${consultation.durationMinutes || 30} minutes</span>
        </div>
        <div class="card-row">
          <span class="label">Format</span>
          <span class="value">${consultation.mode === 'online' ? 'Online · Google Meet' : 'In-Person' + (consultation.location ? ` · ${consultation.location}` : '')}</span>
        </div>
      </div>

      ${consultation.mode === 'online' ? `
        <div class="alert-banner alert-info">
          <strong>Before your session:</strong> Find a quiet, private space with a stable internet connection.
          Have your notes or questions ready.
        </div>` : ''}

      <div class="btn-center">
        ${meetLink ? `<a href="${meetLink}" class="btn" style="margin-right:12px;">Join Meeting →</a>` : ''}
        ${calendarLink ? `<a href="${calendarLink}" class="btn-outline">Add to Calendar</a>` : ''}
      </div>

      <p style="font-size:14px; color:#6b7280; line-height:1.7; margin-top:8px;">
        Need to reschedule? Contact your clinician or the wellness team as soon as possible.
      </p>
    </div>
    ${htmlFooter()}
  `);

  return sendEmail({
    to, subject, html,
    text: `Consultation Scheduled\n${consultationTime} IST\n${consultation.durationMinutes || 30} minutes\n${meetLink || ''}`
  });
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * PASSWORD RESET                                                               *
 * ─────────────────────────────────────────────────────────────────────────── */
async function sendPasswordReset({ to, name, resetUrl, expiresIn }) {
  const subject = 'Reset your Vocalysis password';
  const expiry = typeof expiresIn === 'number' ? `${expiresIn} minutes` : expiresIn;

  const html = wrapHtml(`
    ${htmlHeader('Password Reset', 'We received a request to reset your password')}
    <div class="body">
      <p class="greeting">Hi <strong>${name}</strong>,</p>
      <p style="font-size:15px; color:#374151; line-height:1.7; margin-bottom:24px;">
        Someone requested a password reset for your Vocalysis account.
        Click the button below to create a new password.
      </p>

      <div class="btn-center">
        <a href="${resetUrl}" class="btn">Reset Password →</a>
      </div>

      <div class="card" style="margin-top:8px;">
        <div class="card-row">
          <span class="label">Link expires in</span>
          <span class="value">${expiry}</span>
        </div>
      </div>

      <div class="alert-banner alert-warning" style="margin-top:20px;">
        <strong>Didn't request this?</strong> You can safely ignore this email.
        Your password will not be changed unless you click the link above.
        Never share this link with anyone.
      </div>
    </div>
    ${htmlFooter()}
  `);

  return sendEmail({
    to, subject, html,
    text: `Password Reset\n\nHi ${name},\n\nReset your password: ${resetUrl}\n\nExpires in: ${expiry}`
  });
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * WEEKLY HR REPORT                                                             *
 * ─────────────────────────────────────────────────────────────────────────── */
async function sendWeeklyHRReport({ to, hrAdmin, reportData, tenantName }) {
  const subject = `Weekly Wellness Report — ${tenantName}`;
  const reportDate = new Date().toLocaleDateString('en-IN', { dateStyle: 'long' });

  const alertRows = (reportData.recentAlerts || []).slice(0, 5).map(a => `
    <tr style="border-bottom: 1px solid #f3f0ff;">
      <td style="padding:12px 0; font-size:14px; color:#374151;">${a.employeeName}</td>
      <td style="padding:12px 0; font-size:14px;">
        <span class="tag tag-${a.level}">${a.level?.toUpperCase()}</span>
      </td>
      <td style="padding:12px 0; font-size:14px; color:#6b7280;">${a.status}</td>
    </tr>
  `).join('');

  const html = wrapHtml(`
    ${htmlHeader(`Weekly Report · ${tenantName}`, reportDate)}
    <div class="body">
      <p class="greeting">Hi <strong>${hrAdmin.firstName}</strong>, here's your weekly wellness summary.</p>

      <div class="stat-grid">
        <div class="stat-box">
          <div class="stat-value">${reportData.totalAssessments || 0}</div>
          <div class="stat-label">Assessments</div>
        </div>
        <div class="stat-box">
          <div class="stat-value">${reportData.activeAlerts || 0}</div>
          <div class="stat-label">Active Alerts</div>
        </div>
        <div class="stat-box">
          <div class="stat-value">${reportData.avgWellnessScore || '—'}</div>
          <div class="stat-label">Avg Score</div>
        </div>
      </div>

      ${alertRows ? `
        <h3 style="font-size:15px; font-weight:600; color:#1e1b2e; margin-bottom:4px;">Recent Alerts</h3>
        <table style="width:100%; border-collapse:collapse; margin:16px 0;">
          <thead>
            <tr style="border-bottom: 2px solid #ede9fe;">
              <th style="text-align:left; padding-bottom:10px; font-size:13px; color:#7c3aed; font-weight:600;">Employee</th>
              <th style="text-align:left; padding-bottom:10px; font-size:13px; color:#7c3aed; font-weight:600;">Level</th>
              <th style="text-align:left; padding-bottom:10px; font-size:13px; color:#7c3aed; font-weight:600;">Status</th>
            </tr>
          </thead>
          <tbody>${alertRows}</tbody>
        </table>` : ''}

      <div class="btn-center" style="margin-top:32px;">
        <a href="${PLATFORM_URL}/analytics" class="btn">View Full Dashboard →</a>
      </div>
    </div>
    ${htmlFooter()}
  `);

  return sendEmail({
    to, subject, html,
    text: `Weekly Report — ${tenantName}\nAssessments: ${reportData.totalAssessments || 0}\nAlerts: ${reportData.activeAlerts || 0}`
  });
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * CONSULTATION REMINDER                                                        *
 * ─────────────────────────────────────────────────────────────────────────── */
async function sendConsultationReminder({ to, consultation, minutesBefore }) {
  const subject = `Reminder: Your consultation starts in ${minutesBefore} minutes`;
  const time = new Date(consultation.scheduledAt).toLocaleTimeString('en-IN', {
    timeStyle: 'short', timeZone: 'Asia/Kolkata'
  });

  const html = wrapHtml(`
    ${htmlHeader(`Your session starts in ${minutesBefore} min`, time + ' IST')}
    <div class="body">
      <p class="greeting">Your wellness consultation is about to begin!</p>

      ${consultation.mode === 'online' ? `
        <div class="alert-banner alert-info" style="margin-bottom:24px;">
          Make sure you're in a quiet, private space with a stable internet connection.
        </div>
        <div class="btn-center">
          <a href="${consultation.meetLink}" class="btn">Join Meeting Now →</a>
        </div>` : `
        <div class="alert-banner alert-info">
          Please head to the scheduled location on time.
          ${consultation.location ? `<br><strong>Location:</strong> ${consultation.location}` : ''}
        </div>`}
    </div>
    ${htmlFooter()}
  `);

  return sendEmail({
    to, subject, html,
    text: `Your consultation starts in ${minutesBefore} minutes at ${time} IST${consultation.meetLink ? `\nJoin: ${consultation.meetLink}` : ''}`
  });
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * ALERT ESCALATION                                                             *
 * ─────────────────────────────────────────────────────────────────────────── */
async function sendAlertEscalationNotification({ to, alert, employee, reason }) {
  const subject = `ESCALATED: ${employee.firstName} ${employee.lastName} — Immediate attention needed`;

  const html = wrapHtml(`
    <div class="header" style="background: linear-gradient(135deg, #7f1d1d 0%, #dc2626 100%);">
      <div class="logo-badge">
        <span class="logo-icon">V</span>
        <span class="logo-text">Vocalysis &nbsp;·&nbsp; ${BRAND_NAME}</span>
      </div>
      <h1>Alert Escalated</h1>
      <p>This case requires your immediate review</p>
    </div>
    <div class="body">
      <div class="alert-banner alert-danger">
        <strong>This alert has been escalated to you.</strong> Please review and take action as per your protocols.
      </div>

      <div class="card">
        <div class="card-row">
          <span class="label">Employee</span>
          <span class="value">${employee.firstName} ${employee.lastName}</span>
        </div>
        <div class="card-row">
          <span class="label">Alert level</span>
          <span class="value">
            <span class="tag tag-critical">${(alert.alertLevel || 'CRITICAL').toUpperCase()}</span>
          </span>
        </div>
        <div class="card-row">
          <span class="label">Escalation reason</span>
          <span class="value">${reason}</span>
        </div>
      </div>

      <div class="btn-center">
        <a href="${PLATFORM_URL}/alerts/${alert._id}" class="btn">Review Case →</a>
      </div>

      <p style="font-size:13px; color:#9ca3af; margin-top:16px; line-height:1.6;">
        This alert is confidential. Handle in accordance with your organisation's safeguarding policies.
      </p>
    </div>
    ${htmlFooter()}
  `);

  return sendEmail({
    to, subject, html,
    text: `ESCALATED: ${employee.firstName} ${employee.lastName}\nReason: ${reason}\n${PLATFORM_URL}/alerts/${alert._id}`
  });
}

/* ─────────────────────────────────────────────────────────────────────────── */

module.exports = {
  sendEmail,
  sendWelcomeEmail,
  sendAssessmentInvite,
  sendAlertNotification,
  sendConsultationInvite,
  sendPasswordReset,
  sendWeeklyHRReport,
  sendConsultationReminder,
  sendAlertEscalationNotification,
};
