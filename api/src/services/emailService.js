const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    this.fromEmail = process.env.SMTP_FROM_EMAIL || 'noreply@cittaa.com';
    this.brandName = 'Cittaa Health Services';
  }

  /**
   * Base email sending method
   */
  async sendEmail({ to, subject, html, text }) {
    try {
      const result = await this.transporter.sendMail({
        from: this.fromEmail,
        to,
        subject,
        html,
        text,
        headers: {
          'X-Mailer': 'Vocalysis Platform v2.0'
        }
      });

      logger.debug('Email sent', {
        to,
        subject,
        messageId: result.messageId
      });

      return { success: true, messageId: result.messageId };
    } catch (err) {
      logger.error('Failed to send email', {
        error: err.message,
        to,
        subject
      });
      throw new Error('Failed to send email');
    }
  }

  /**
   * Send assessment invitation email
   */
  async sendAssessmentInvite({ employee, clinicianName, assessmentUrl, scheduledAt }) {
    const subject = `Assessment Invitation from ${clinicianName}`;
    const scheduledDate = new Date(scheduledAt).toLocaleString('en-IN', {
      dateStyle: 'long',
      timeStyle: 'short',
      timeZone: 'Asia/Kolkata'
    });

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #0066cc; color: white; padding: 20px; text-align: center; border-radius: 4px 4px 0 0; }
    .content { background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd; border-top: none; }
    .button { display: inline-block; background-color: #0066cc; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; margin: 20px 0; }
    .footer { font-size: 12px; color: #666; margin-top: 30px; text-align: center; border-top: 1px solid #ddd; padding-top: 20px; }
    .info-box { background-color: #e8f4f8; padding: 15px; border-left: 4px solid #0066cc; margin: 15px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>VocaCore™ Assessment Invitation</h1>
    </div>
    <div class="content">
      <p>Hello ${employee.firstName},</p>

      <p>${clinicianName} has invited you to complete a VocaCore™ wellness assessment. This assessment analyzes your voice to provide personalized insights about your emotional wellness.</p>

      <div class="info-box">
        <strong>Assessment Scheduled:</strong><br>
        ${scheduledDate} IST
      </div>

      <p>The assessment typically takes 5-10 minutes and can be completed from any quiet location using your computer or mobile device.</p>

      <center>
        <a href="${assessmentUrl}" class="button">Start Assessment</a>
      </center>

      <p>If you have any questions, please contact your clinician or the wellness team.</p>

      <div class="footer">
        <p>Powered by VocaCore™ | ${this.brandName}</p>
        <p>This is an automated message. Please do not reply to this email.</p>
      </div>
    </div>
  </div>
</body>
</html>`;

    const text = `Assessment Invitation\n\nHello ${employee.firstName},\n\n${clinicianName} has invited you to complete a VocaCore™ wellness assessment.\n\nScheduled: ${scheduledDate} IST\n\nClick here to start: ${assessmentUrl}`;

    return this.sendEmail({
      to: employee.email,
      subject,
      html,
      text
    });
  }

  /**
   * Send alert notification email
   */
  async sendAlertNotification({ to, alert, employee, tenantName }) {
    const alertLevelLabel = {
      high: 'High Priority',
      critical: 'Critical Priority'
    };

    const subject = `[${alertLevelLabel[alert.alertLevel] || 'Alert'}] Wellness Alert for ${employee.firstName} ${employee.lastName}`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: ${alert.alertLevel === 'critical' ? '#d32f2f' : '#f57c00'}; color: white; padding: 20px; text-align: center; border-radius: 4px 4px 0 0; }
    .content { background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd; border-top: none; }
    .alert-box { background-color: ${alert.alertLevel === 'critical' ? '#ffebee' : '#fff3e0'}; border-left: 4px solid ${alert.alertLevel === 'critical' ? '#d32f2f' : '#f57c00'}; padding: 15px; margin: 15px 0; }
    .score { display: inline-block; background-color: #fff; padding: 10px 15px; border-radius: 4px; margin: 5px; font-weight: bold; }
    .footer { font-size: 12px; color: #666; margin-top: 30px; text-align: center; border-top: 1px solid #ddd; padding-top: 20px; }
    .action-button { display: inline-block; background-color: ${alert.alertLevel === 'critical' ? '#d32f2f' : '#f57c00'}; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${alertLevelLabel[alert.alertLevel] || 'Alert'}</h1>
    </div>
    <div class="content">
      <p>A wellness alert has been triggered in ${tenantName}.</p>

      <div class="alert-box">
        <strong>Employee:</strong> ${employee.firstName} ${employee.lastName}<br>
        <strong>Alert Level:</strong> ${alert.alertLevel.toUpperCase()}<br>
        <strong>Triggered Scores:</strong><br>
        ${alert.triggeringScores.map(score => `<span class="score">${score}</span>`).join('')}
      </div>

      <p>This alert indicates that the employee may benefit from additional support or consultation. Please review the assessment results and consider taking appropriate action.</p>

      <center>
        <a href="${process.env.PLATFORM_URL}/alerts/${alert._id}" class="action-button">Review Alert</a>
      </center>

      <div class="footer">
        <p>Powered by VocaCore™ | ${this.brandName}</p>
        <p>This is an automated alert system. Please handle with appropriate confidentiality.</p>
      </div>
    </div>
  </div>
</body>
</html>`;

    const text = `Wellness Alert\n\nAlert Level: ${alert.alertLevel.toUpperCase()}\nEmployee: ${employee.firstName} ${employee.lastName}\n\nTriggering Scores:\n${alert.triggeringScores.join('\n')}\n\nPlease review the assessment results and consider taking appropriate action.`;

    return this.sendEmail({
      to,
      subject,
      html,
      text
    });
  }

  /**
   * Send consultation invitation email
   */
  async sendConsultationInvite({ to, consultation, meetLink, calendarLink }) {
    const subject = 'Consultation Scheduled - VocaCore™ Wellness Program';
    const consultationTime = new Date(consultation.scheduledAt).toLocaleString('en-IN', {
      dateStyle: 'long',
      timeStyle: 'short',
      timeZone: 'Asia/Kolkata'
    });

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #0066cc; color: white; padding: 20px; text-align: center; border-radius: 4px 4px 0 0; }
    .content { background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd; border-top: none; }
    .details-box { background-color: #e8f4f8; padding: 15px; border-left: 4px solid #0066cc; margin: 15px 0; }
    .button { display: inline-block; background-color: #0066cc; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; margin: 10px 5px; }
    .footer { font-size: 12px; color: #666; margin-top: 30px; text-align: center; border-top: 1px solid #ddd; padding-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Consultation Scheduled</h1>
    </div>
    <div class="content">
      <p>Your wellness consultation has been scheduled.</p>

      <div class="details-box">
        <strong>Date & Time:</strong><br>
        ${consultationTime} IST<br><br>
        <strong>Duration:</strong><br>
        ${consultation.durationMinutes} minutes<br><br>
        <strong>Type:</strong><br>
        ${consultation.mode === 'online' ? 'Online (Google Meet)' : 'In-Person'}
        ${consultation.location ? ` - ${consultation.location}` : ''}
      </div>

      <p>Your clinician will provide personalized recommendations based on your assessment results.</p>

      <div style="text-align: center;">
        ${meetLink ? `<a href="${meetLink}" class="button">Join Meeting</a>` : ''}
        ${calendarLink ? `<a href="${calendarLink}" class="button">Add to Calendar</a>` : ''}
      </div>

      <p>If you need to reschedule or have any questions, please contact the wellness team.</p>

      <div class="footer">
        <p>Powered by VocaCore™ | ${this.brandName}</p>
      </div>
    </div>
  </div>
</body>
</html>`;

    const text = `Consultation Scheduled\n\nDate & Time: ${consultationTime} IST\nDuration: ${consultation.durationMinutes} minutes\nType: ${consultation.mode === 'online' ? 'Online (Google Meet)' : 'In-Person'}${consultation.location ? ` - ${consultation.location}` : ''}\n\nMeeting Link: ${meetLink || 'N/A'}\n\nCalendar Link: ${calendarLink || 'N/A'}`;

    return this.sendEmail({
      to,
      subject,
      html,
      text
    });
  }

  /**
   * Send welcome email to new user
   */
  async sendWelcomeEmail({ to, name, loginUrl, tempPassword, companyName }) {
    const subject = `Welcome to Vocalysis Platform - ${companyName}`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #0066cc; color: white; padding: 20px; text-align: center; border-radius: 4px 4px 0 0; }
    .content { background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd; border-top: none; }
    .credential-box { background-color: #f0f0f0; padding: 15px; border: 1px solid #ccc; border-radius: 4px; font-family: monospace; margin: 15px 0; }
    .button { display: inline-block; background-color: #0066cc; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; margin: 20px 0; }
    .footer { font-size: 12px; color: #666; margin-top: 30px; text-align: center; border-top: 1px solid #ddd; padding-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Welcome to Vocalysis!</h1>
    </div>
    <div class="content">
      <p>Hello ${name},</p>

      <p>Welcome to the Vocalysis Platform powered by ${this.brandName}. Your account has been created and is ready to use.</p>

      <p><strong>Your temporary login credentials:</strong></p>
      <div class="credential-box">
        Email: ${to}<br>
        Temporary Password: ${tempPassword}
      </div>

      <p>Please log in and change your password immediately for security purposes.</p>

      <center>
        <a href="${loginUrl}" class="button">Log In Now</a>
      </center>

      <p><strong>Next Steps:</strong></p>
      <ul>
        <li>Complete your account setup</li>
        <li>Change your temporary password</li>
        <li>Enable two-factor authentication (recommended)</li>
        <li>Familiarize yourself with the platform</li>
      </ul>

      <p>If you have any questions or need assistance, please contact your administrator.</p>

      <div class="footer">
        <p>Powered by VocaCore™ | ${this.brandName}</p>
      </div>
    </div>
  </div>
</body>
</html>`;

    const text = `Welcome to Vocalysis!\n\nHello ${name},\n\nYour account has been created.\n\nTemporary Login:\nEmail: ${to}\nPassword: ${tempPassword}\n\nPlease log in and change your password immediately.\n\nLogin URL: ${loginUrl}`;

    return this.sendEmail({
      to,
      subject,
      html,
      text
    });
  }

  /**
   * Send password reset email
   */
  async sendPasswordReset({ to, name, resetUrl, expiresIn }) {
    const subject = 'Password Reset Request - Vocalysis Platform';
    const expiresText = typeof expiresIn === 'number' ? `This link expires in ${expiresIn} minutes.` : expiresIn;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #0066cc; color: white; padding: 20px; text-align: center; border-radius: 4px 4px 0 0; }
    .content { background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd; border-top: none; }
    .button { display: inline-block; background-color: #0066cc; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; margin: 20px 0; }
    .warning-box { background-color: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 15px 0; }
    .footer { font-size: 12px; color: #666; margin-top: 30px; text-align: center; border-top: 1px solid #ddd; padding-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Password Reset Request</h1>
    </div>
    <div class="content">
      <p>Hello ${name},</p>

      <p>We received a request to reset your password. Click the button below to create a new password.</p>

      <center>
        <a href="${resetUrl}" class="button">Reset Password</a>
      </center>

      <p>${expiresText}</p>

      <div class="warning-box">
        <strong>Security Note:</strong> If you did not request this password reset, please ignore this email. Your account remains secure.
      </div>

      <p>For security, never share this link or your password with anyone.</p>

      <div class="footer">
        <p>Powered by VocaCore™ | ${this.brandName}</p>
      </div>
    </div>
  </div>
</body>
</html>`;

    const text = `Password Reset Request\n\nHello ${name},\n\nClick here to reset your password: ${resetUrl}\n\n${expiresText}\n\nIf you did not request this, please ignore this email.`;

    return this.sendEmail({
      to,
      subject,
      html,
      text
    });
  }

  /**
   * Send weekly HR report email
   */
  async sendWeeklyHRReport({ to, hrAdmin, reportData, tenantName }) {
    const subject = `Weekly Wellness Report - ${tenantName}`;
    const reportDate = new Date().toLocaleDateString('en-IN');

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; color: #333; }
    .container { max-width: 700px; margin: 0 auto; padding: 20px; }
    .header { background-color: #0066cc; color: white; padding: 20px; text-align: center; border-radius: 4px 4px 0 0; }
    .content { background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd; border-top: none; }
    .stat-box { display: inline-block; background-color: white; padding: 15px 20px; margin: 10px; border-radius: 4px; border: 1px solid #ddd; text-align: center; }
    .stat-value { font-size: 24px; font-weight: bold; color: #0066cc; }
    .stat-label { font-size: 12px; color: #666; margin-top: 5px; }
    .table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    .table th { background-color: #0066cc; color: white; padding: 10px; text-align: left; }
    .table td { padding: 10px; border-bottom: 1px solid #ddd; }
    .table tr:nth-child(even) { background-color: #f5f5f5; }
    .button { display: inline-block; background-color: #0066cc; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; margin: 20px 0; }
    .footer { font-size: 12px; color: #666; margin-top: 30px; text-align: center; border-top: 1px solid #ddd; padding-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Weekly Wellness Report</h1>
      <p>${tenantName} | ${reportDate}</p>
    </div>
    <div class="content">
      <p>Hello ${hrAdmin.firstName},</p>

      <p>Here is your weekly wellness summary for ${tenantName}:</p>

      <div style="text-align: center; margin: 30px 0;">
        <div class="stat-box">
          <div class="stat-value">${reportData.totalAssessments || 0}</div>
          <div class="stat-label">Assessments</div>
        </div>
        <div class="stat-box">
          <div class="stat-value">${reportData.activeAlerts || 0}</div>
          <div class="stat-label">Active Alerts</div>
        </div>
        <div class="stat-box">
          <div class="stat-value">${reportData.avgWellnessScore || 'N/A'}</div>
          <div class="stat-label">Avg Wellness Score</div>
        </div>
      </div>

      <h3>Recent Alerts</h3>
      <table class="table">
        <tr>
          <th>Employee</th>
          <th>Alert Level</th>
          <th>Status</th>
        </tr>
        ${(reportData.recentAlerts || []).slice(0, 5).map(alert => `
          <tr>
            <td>${alert.employeeName}</td>
            <td>${alert.level.toUpperCase()}</td>
            <td>${alert.status}</td>
          </tr>
        `).join('')}
      </table>

      <p>For detailed analytics and employee data, log into the platform:</p>

      <center>
        <a href="${process.env.PLATFORM_URL}/analytics" class="button">View Dashboard</a>
      </center>

      <div class="footer">
        <p>Powered by VocaCore™ | ${this.brandName}</p>
        <p>This report is automatically generated weekly.</p>
      </div>
    </div>
  </div>
</body>
</html>`;

    const text = `Weekly Wellness Report\n\n${tenantName} | ${reportDate}\n\nTotal Assessments: ${reportData.totalAssessments || 0}\nActive Alerts: ${reportData.activeAlerts || 0}\nAverage Wellness Score: ${reportData.avgWellnessScore || 'N/A'}\n\nView Dashboard: ${process.env.PLATFORM_URL}/analytics`;

    return this.sendEmail({
      to,
      subject,
      html,
      text
    });
  }

  /**
   * Send consultation reminder email
   */
  async sendConsultationReminder({ to, consultation, minutesBefore }) {
    const subject = `Reminder: Your Consultation is in ${minutesBefore} minutes`;
    const consultationTime = new Date(consultation.scheduledAt).toLocaleTimeString('en-IN', {
      timeStyle: 'short',
      timeZone: 'Asia/Kolkata'
    });

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #0066cc; color: white; padding: 20px; text-align: center; border-radius: 4px 4px 0 0; }
    .content { background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd; border-top: none; }
    .alert-box { background-color: #e8f4f8; padding: 15px; border-left: 4px solid #0066cc; margin: 15px 0; }
    .button { display: inline-block; background-color: #0066cc; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; margin: 20px 0; }
    .footer { font-size: 12px; color: #666; margin-top: 30px; text-align: center; border-top: 1px solid #ddd; padding-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Consultation Reminder</h1>
    </div>
    <div class="content">
      <div class="alert-box">
        <strong>Your consultation is in ${minutesBefore} minutes!</strong><br>
        Time: ${consultationTime} IST
      </div>

      <p>Get ready for your wellness consultation. ${consultation.mode === 'online' ? 'Make sure you have a quiet space and a good internet connection.' : 'Please arrive on time at the scheduled location.'}</p>

      ${consultation.meetLink ? `
        <center>
          <a href="${consultation.meetLink}" class="button">Join Meeting</a>
        </center>
      ` : ''}

      <p>If you need to reschedule, please contact your clinician as soon as possible.</p>

      <div class="footer">
        <p>Powered by VocaCore™ | ${this.brandName}</p>
      </div>
    </div>
  </div>
</body>
</html>`;

    const text = `Consultation Reminder\n\nYour consultation is in ${minutesBefore} minutes!\nTime: ${consultationTime} IST\n\n${consultation.meetLink ? `Meeting Link: ${consultation.meetLink}` : 'Please arrive on time.'}`;

    return this.sendEmail({
      to,
      subject,
      html,
      text
    });
  }

  /**
   * Send alert escalation notification
   */
  async sendAlertEscalationNotification({ to, alert, employee, reason }) {
    const subject = `Alert Escalation: ${employee.firstName} ${employee.lastName}`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #d32f2f; color: white; padding: 20px; text-align: center; border-radius: 4px 4px 0 0; }
    .content { background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd; border-top: none; }
    .alert-box { background-color: #ffebee; border-left: 4px solid #d32f2f; padding: 15px; margin: 15px 0; }
    .button { display: inline-block; background-color: #d32f2f; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; margin: 20px 0; }
    .footer { font-size: 12px; color: #666; margin-top: 30px; text-align: center; border-top: 1px solid #ddd; padding-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Alert Escalation</h1>
    </div>
    <div class="content">
      <p>An alert has been escalated to you for immediate attention.</p>

      <div class="alert-box">
        <strong>Employee:</strong> ${employee.firstName} ${employee.lastName}<br>
        <strong>Alert Level:</strong> ${alert.alertLevel.toUpperCase()}<br>
        <strong>Escalation Reason:</strong> ${reason}
      </div>

      <p>Please review this case and take appropriate action as per your protocols.</p>

      <center>
        <a href="${process.env.PLATFORM_URL}/alerts/${alert._id}" class="button">Review Alert</a>
      </center>

      <div class="footer">
        <p>Powered by VocaCore™ | ${this.brandName}</p>
        <p>This is a confidential alert requiring immediate attention.</p>
      </div>
    </div>
  </div>
</body>
</html>`;

    const text = `Alert Escalation\n\nEmployee: ${employee.firstName} ${employee.lastName}\nAlert Level: ${alert.alertLevel.toUpperCase()}\nReason: ${reason}\n\nReview Alert: ${process.env.PLATFORM_URL}/alerts/${alert._id}`;

    return this.sendEmail({
      to,
      subject,
      html,
      text
    });
  }
}

module.exports = new EmailService();
