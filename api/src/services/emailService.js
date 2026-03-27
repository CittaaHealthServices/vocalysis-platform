/**
 * EmailService — Vocalysis / Cittaa Platform
 * Beautiful, soothing transactional emails via Resend
 * Designed with mental-health sensitivity in mind:
 *   warm tones · empathetic copy · calm, non-clinical aesthetic
 */
const logger = require('../utils/logger');

// Resend is loaded lazily so a missing API key doesn't crash the server
let _resend = null;
function getResend() {
  if (!_resend) {
    const { Resend } = require('resend');
    const key = process.env.RESEND_API_KEY;
    if (!key) {
      logger.warn('RESEND_API_KEY not set — emails will be skipped');
      return null;
    }
    _resend = new Resend(key);
  }
  return _resend;
}

const FROM_EMAIL   = process.env.RESEND_FROM_EMAIL || 'info@cittaa.in';
const BRAND_NAME   = 'Cittaa Health Services';
const PLATFORM_URL = process.env.PLATFORM_URL || 'https://striking-bravery-production-c13e.up.railway.app';

/* ─────────────────────────────────────────────────────────────────────────── *
 * Design tokens — warm, soothing, mental-health palette                       *
 *  Primary   : soft sage-teal  #4a9080                                        *
 *  Accent    : warm lavender   #8b7dd8                                        *
 *  Background: creamy white    #fdfcfb                                        *
 *  Surface   : pale sage       #f3f7f5                                        *
 * ─────────────────────────────────────────────────────────────────────────── */
const C = {
  primary:   '#4a9080',
  accent:    '#8b7dd8',
  warm:      '#c27d5a',
  danger:    '#c0544a',
  text:      '#2d3748',
  muted:     '#718096',
  surface:   '#f3f7f5',
  border:    '#e2eae7',
  white:     '#ffffff',
  bodyBg:    '#f0f4f2',
};

/* ── Shared CSS ────────────────────────────────────────────────────────────── */
const BASE_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Serif+Display&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: ${C.bodyBg};
    color: ${C.text};
    -webkit-font-smoothing: antialiased;
  }
  .wrapper {
    max-width: 600px;
    margin: 32px auto;
    background: ${C.white};
    border-radius: 20px;
    overflow: hidden;
    box-shadow: 0 2px 32px rgba(74,144,128,0.10), 0 1px 4px rgba(0,0,0,0.04);
  }

  /* ── Header ── */
  .header {
    padding: 44px 48px 40px;
    position: relative;
    overflow: hidden;
  }
  .header::before {
    content: '';
    position: absolute; inset: 0;
    background: radial-gradient(ellipse at 70% 30%, rgba(255,255,255,0.15) 0%, transparent 60%);
    pointer-events: none;
  }
  .logo-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 32px;
  }
  .logo-mark {
    width: 34px; height: 34px;
    background: rgba(255,255,255,0.25);
    border: 1px solid rgba(255,255,255,0.35);
    border-radius: 9px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-weight: 900;
    font-size: 16px;
    color: #fff;
    font-family: 'DM Serif Display', serif;
    vertical-align: middle;
    padding: 5px;
  }
  .logo-name {
    font-size: 14px; font-weight: 600;
    color: rgba(255,255,255,0.9);
    letter-spacing: 0.2px;
    font-family: 'DM Serif Display', serif;
  }
  .header h1 {
    font-size: 24px; font-weight: 700;
    color: #fff;
    letter-spacing: -0.3px;
    line-height: 1.3;
    font-family: 'DM Serif Display', serif;
  }
  .header .subtitle {
    margin-top: 8px;
    font-size: 14px;
    color: rgba(255,255,255,0.72);
    line-height: 1.5;
  }

  /* ── Body ── */
  .body { padding: 40px 48px; }
  .greeting {
    font-size: 15px; color: ${C.text};
    line-height: 1.75; margin-bottom: 16px;
  }
  .copy {
    font-size: 14.5px; color: #4a5568;
    line-height: 1.8; margin-bottom: 20px;
  }

  /* ── Card ── */
  .card {
    background: ${C.surface};
    border: 1px solid ${C.border};
    border-radius: 14px;
    padding: 22px 24px;
    margin: 24px 0;
  }
  .card-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding: 9px 0;
    border-bottom: 1px solid ${C.border};
    font-size: 13.5px;
    gap: 16px;
  }
  .card-row:last-child { border-bottom: none; }
  .card-row .lbl { color: ${C.muted}; font-weight: 500; }
  .card-row .val { color: ${C.text};  font-weight: 600; text-align: right; }

  /* ── Button ── */
  .btn-wrap { text-align: center; margin: 32px 0; }
  .btn {
    display: inline-block;
    text-decoration: none;
    font-size: 15px; font-weight: 600;
    padding: 14px 36px;
    border-radius: 12px;
    color: #fff !important;
    letter-spacing: 0.1px;
  }
  .btn-outline {
    display: inline-block;
    text-decoration: none;
    font-size: 14px; font-weight: 600;
    padding: 12px 28px;
    border-radius: 12px;
    color: ${C.primary} !important;
    border: 1.5px solid ${C.primary};
    margin: 6px;
  }

  /* ── Banners ── */
  .banner {
    border-radius: 12px;
    padding: 16px 20px;
    margin: 20px 0;
    font-size: 13.5px;
    line-height: 1.65;
  }
  .banner-info    { background: #eef6f4; border-left: 4px solid ${C.primary}; color: #2d6059; }
  .banner-warm    { background: #fdf4ee; border-left: 4px solid ${C.warm};    color: #6b3a20; }
  .banner-alert   { background: #fdf2f1; border-left: 4px solid ${C.danger};  color: #7a2e28; }
  .banner-lavender{ background: #f3f1fb; border-left: 4px solid ${C.accent};  color: #433874; }

  /* ── Stat pills ── */
  .stat-row { display: flex; gap: 12px; margin: 24px 0; }
  .stat-pill {
    flex: 1; text-align: center;
    background: ${C.surface};
    border: 1px solid ${C.border};
    border-radius: 14px;
    padding: 18px 12px;
  }
  .stat-num { font-size: 26px; font-weight: 700; color: ${C.primary}; letter-spacing: -0.5px; font-family: 'DM Serif Display', serif; }
  .stat-lbl { font-size: 11px; color: ${C.muted}; margin-top: 4px; font-weight: 500; }

  /* ── Feature list ── */
  .feature-item {
    display: flex; align-items: flex-start; gap: 14px;
    padding: 13px 0; border-bottom: 1px solid ${C.border};
  }
  .feature-item:last-child { border-bottom: none; }
  .feature-icon { font-size: 20px; flex-shrink: 0; line-height: 1.4; margin-top: 1px; }
  .feature-title { font-size: 13.5px; font-weight: 600; color: ${C.text}; margin-bottom: 2px; }
  .feature-desc  { font-size: 12.5px; color: ${C.muted}; line-height: 1.55; }

  /* ── Tag ── */
  .tag { display: inline-block; padding: 3px 10px; border-radius: 99px; font-size: 12px; font-weight: 600; }
  .tag-critical { background: #fde8e7; color: #9b2c2c; }
  .tag-high     { background: #fef3e2; color: #92400e; }
  .tag-medium   { background: #fef9c3; color: #713f12; }
  .tag-low      { background: #e6f4f1; color: #1a5c4d; }

  /* ── Divider ── */
  .divider { height: 1px; background: ${C.border}; margin: 28px 0; }

  /* ── Credential box ── */
  .cred-box {
    background: #f8faf9;
    border: 1px solid ${C.border};
    border-radius: 10px;
    padding: 16px 20px;
    font-family: 'Courier New', Courier, monospace;
    font-size: 13px;
    color: ${C.text};
    margin: 16px 0;
    line-height: 2;
  }

  /* ── Footer ── */
  .footer {
    background: ${C.surface};
    border-top: 1px solid ${C.border};
    padding: 28px 48px;
    text-align: center;
  }
  .footer p { font-size: 12px; color: #a0aec0; line-height: 1.9; }
  .footer a { color: ${C.primary}; text-decoration: none; }
  .footer .brand { font-family: 'DM Serif Display', serif; font-weight: 700; color: ${C.primary}; }
  .footer .wave { font-size: 18px; margin-bottom: 8px; display: block; }
`;

/* ── Inline-safe header / footer (works in Gmail which strips <style>) ─────── */
function makeHeader(title, subtitle = '', gradientFrom = C.primary, gradientTo = '#2d6e60') {
  return `
  <div class="header" style="background:linear-gradient(140deg,${gradientFrom} 0%,${gradientTo} 100%);padding:44px 48px 40px;position:relative;overflow:hidden;">
    <!-- Cittaa logo row -->
    <div class="logo-row" style="display:flex;align-items:center;gap:10px;margin-bottom:28px;">
      <span class="logo-mark" style="width:36px;height:36px;background:rgba(255,255,255,0.22);border:1.5px solid rgba(255,255,255,0.35);border-radius:9px;display:inline-flex;align-items:center;justify-content:center;font-weight:900;font-size:17px;color:#fff;font-family:Georgia,serif;vertical-align:middle;text-align:center;line-height:36px;padding:0;">C</span>
      <span class="logo-name" style="font-size:15px;font-weight:700;color:rgba(255,255,255,0.93);letter-spacing:0.3px;font-family:Georgia,'Times New Roman',serif;">Cittaa &nbsp;·&nbsp; ${BRAND_NAME}</span>
    </div>
    <h1 style="font-size:24px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;line-height:1.3;margin:0;font-family:Georgia,'Times New Roman',serif;">${title}</h1>
    ${subtitle ? `<p class="subtitle" style="margin-top:8px;font-size:14px;color:rgba(255,255,255,0.75);line-height:1.5;margin-bottom:0;">${subtitle}</p>` : ''}
  </div>`;
}

function makeFooter() {
  return `
  <div class="footer" style="background:${C.surface};border-top:1px solid ${C.border};padding:28px 48px;text-align:center;">
    <span style="font-size:20px;display:block;margin-bottom:10px;">🌿</span>
    <p style="font-size:12px;color:#718096;line-height:1.9;margin:0;">
      Sent with care by <strong style="font-family:Georgia,serif;color:${C.primary};">Cittaa Health Services</strong>
    </p>
    <p style="font-size:12px;color:#718096;margin:4px 0 0;">
      Powered by <strong style="font-family:Georgia,serif;color:${C.primary};">VocaCore™</strong> &nbsp;·&nbsp;
      <a href="${PLATFORM_URL}" style="color:${C.primary};text-decoration:none;">Open Platform</a>
    </p>
    <p style="margin-top:10px;font-size:11px;color:#a0aec0;line-height:1.7;">
      © ${new Date().getFullYear()} Cittaa Health Services. All rights reserved.<br>
      This is an automated message — please do not reply directly to this email.
    </p>
  </div>`;
}

function wrapHtml(inner) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <style>${BASE_STYLES}</style>
</head>
<body style="margin:0;padding:0;background:${C.bodyBg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <div class="wrapper" style="max-width:600px;margin:32px auto;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 2px 32px rgba(74,144,128,0.10);">
    ${inner}
  </div>
</body>
</html>`;
}

/* ── Core send ──────────────────────────────────────────────────────────────── */
async function sendEmail({ to, subject, html, text }) {
  const resend = getResend();
  if (!resend) {
    logger.warn('Email skipped (no Resend key)', { to, subject });
    return { success: false, skipped: true };
  }
  try {
    const { data, error } = await resend.emails.send({
      from:    FROM_EMAIL,
      to:      Array.isArray(to) ? to : [to],
      subject,
      html,
      text: text || subject,
    });
    if (error) {
      logger.error('Resend error', { error, to, subject });
      throw new Error(error.message || 'Send failed');
    }
    logger.debug('Email sent', { id: data?.id, to, subject });
    return { success: true, id: data?.id };
  } catch (err) {
    logger.error('Failed to send email', { error: err.message, to, subject });
    throw err;
  }
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * WELCOME                                                                      *
 * ─────────────────────────────────────────────────────────────────────────── */
async function sendWelcomeEmail({ to, name, loginUrl, tempPassword, companyName }) {
  const subject = `Welcome to Cittaa — your wellness journey starts today 🌱`;

  const html = wrapHtml(`
    ${makeHeader(`Welcome, ${name} 🌱`, `Your account is ready at ${companyName}`)}
    <div class="body" style="padding:40px 48px;">
      <p class="greeting" style="font-size:15px;color:${C.text};line-height:1.75;margin-bottom:16px;">Hi <strong>${name}</strong>,</p>
      <p class="copy" style="font-size:14.5px;color:#4a5568;line-height:1.8;margin-bottom:20px;">
        We're genuinely glad you're here. <strong>${companyName}</strong> has set up your Cittaa
        wellness account — a private, supportive space to check in with yourself, track your
        wellbeing, and access care whenever you need it.
      </p>

      <div class="card" style="background:${C.surface};border:1px solid ${C.border};border-radius:14px;padding:22px 24px;margin:24px 0;">
        <div class="card-row" style="display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid ${C.border};font-size:13.5px;">
          <span style="color:${C.muted};font-weight:500;">Your email</span>
          <span style="color:${C.text};font-weight:600;">${to}</span>
        </div>
        <div class="card-row" style="display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid ${C.border};font-size:13.5px;">
          <span style="color:${C.muted};font-weight:500;">Temporary password</span>
          <span style="color:${C.text};font-weight:600;font-family:'Courier New',monospace;letter-spacing:1px;">${tempPassword}</span>
        </div>
        <div class="card-row" style="display:flex;justify-content:space-between;padding:9px 0;font-size:13.5px;">
          <span style="color:${C.muted};font-weight:500;">Organisation</span>
          <span style="color:${C.text};font-weight:600;">${companyName}</span>
        </div>
      </div>

      <div class="banner banner-warm" style="background:#fdf4ee;border-left:4px solid ${C.warm};border-radius:12px;padding:16px 20px;margin:20px 0;font-size:13.5px;line-height:1.65;color:#6b3a20;">
        <strong>One small step:</strong> Log in and set a new password that feels personal to you.
        Your temporary password expires in 24 hours.
      </div>

      <div class="btn-wrap" style="text-align:center;margin:32px 0;">
        <a href="${loginUrl}" class="btn" style="display:inline-block;text-decoration:none;font-size:15px;font-weight:700;padding:15px 38px;border-radius:12px;color:#ffffff !important;background:linear-gradient(135deg,${C.primary},#2d6e60);letter-spacing:0.1px;">Sign in to Cittaa →</a>
      </div>

      <div class="divider" style="height:1px;background:${C.border};margin:28px 0;"></div>
      <p class="copy" style="font-size:13px;color:${C.muted};line-height:1.8;">
        Everything on this platform is confidential. Your data belongs to you —
        it is never shared without your explicit consent. If you have questions,
        reach out to your HR team or administrator.
      </p>
    </div>
    ${makeFooter()}
  `);

  return sendEmail({ to, subject, html, text: `Welcome to Cittaa!\n\nEmail: ${to}\nTemp Password: ${tempPassword}\nLogin: ${loginUrl}` });
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * 14-DAY TRIAL INVITATION                                                      *
 * ─────────────────────────────────────────────────────────────────────────── */
async function sendTrialInvite({ to, name, companyName, daysLeft, endDate, loginUrl }) {
  const subject = `${companyName} has gifted you a free wellbeing trial 🎁`;
  const endStr  = new Date(endDate).toLocaleDateString('en-IN', { dateStyle: 'long' });

  const features = [
    { icon: '🎙️', title: 'Voice Wellness Check-ins',    desc: 'Speak naturally for 30 sec – 2 min. Our AI listens for wellbeing signals — no transcription, no judgment.'  },
    { icon: '📊', title: 'Personal Wellness Dashboard', desc: 'See your emotional trends over time and get gentle, personalised suggestions.' },
    { icon: '💬', title: '1:1 Support Sessions',        desc: 'Book a private consultation with a qualified clinician or EAP counsellor.'  },
    { icon: '📚', title: 'Self-help Resource Library',  desc: 'Guided exercises, stress-management tools, and wellbeing workbooks.'  },
  ];

  const html = wrapHtml(`
    ${makeHeader(`A gift for your wellbeing, ${name} 🎁`, `${daysLeft}-day free trial from ${companyName}`, C.accent, '#5c4ac7')}
    <div class="body" style="padding:40px 48px;">
      <p class="greeting">Hi <strong>${name}</strong>,</p>
      <p class="copy">
        <strong>${companyName}</strong> cares about your wellbeing and has given you
        <strong>${daysLeft} days of free access</strong> to the Cittaa wellness platform.
        No payment, no commitment — just support, whenever you want it.
      </p>

      <div class="card" style="background:#f5f3fb; border-color:#ddd8f5;">
        ${features.map(f => `
          <div class="feature-item">
            <span class="feature-icon">${f.icon}</span>
            <div>
              <p class="feature-title">${f.title}</p>
              <p class="feature-desc">${f.desc}</p>
            </div>
          </div>`).join('')}
      </div>

      <div class="card" style="margin-top:4px;">
        <div class="card-row"><span class="lbl">Trial duration</span><span class="val">${daysLeft} days — free</span></div>
        <div class="card-row"><span class="lbl">Access expires</span><span class="val">${endStr}</span></div>
        <div class="card-row"><span class="lbl">Credit card needed?</span><span class="val" style="color:${C.primary};">No — completely free</span></div>
      </div>

      <div class="btn-wrap" style="text-align:center;margin:32px 0;">
        <a href="${loginUrl}" class="btn" style="background: linear-gradient(135deg, ${C.accent}, #5c4ac7);">Begin My Free Trial →</a>
      </div>

      <p style="font-size:12.5px; color:${C.muted}; text-align:center; line-height:1.7;">
        Your trial access ends on <strong>${endStr}</strong>. After that, talk to your HR team about continuing.
        Everything you share is strictly confidential.
      </p>
    </div>
    ${makeFooter()}
  `);

  return sendEmail({
    to, subject, html,
    text: `${companyName} has given you a ${daysLeft}-day free Cittaa trial!\nLogin: ${loginUrl}\nExpires: ${endStr}`
  });
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * TRIAL EXPIRY REMINDER                                                        *
 * ─────────────────────────────────────────────────────────────────────────── */
async function sendTrialExpiryReminder({ to, name, companyName, daysLeft, endDate, loginUrl }) {
  const subject = daysLeft <= 1
    ? `Your Cittaa trial ends today — last chance to check in 🕐`
    : `${daysLeft} days left in your Cittaa trial — ${companyName}`;
  const endStr  = new Date(endDate).toLocaleDateString('en-IN', { dateStyle: 'long' });
  const isUrgent = daysLeft <= 2;

  const html = wrapHtml(`
    ${makeHeader(
      isUrgent ? `Your trial ends ${daysLeft <= 1 ? 'today' : 'very soon'} 🕐` : `${daysLeft} days of trial left`,
      `Make the most of your Cittaa access before ${endStr}`,
      isUrgent ? C.warm : C.primary,
      isUrgent ? '#8a4520' : '#2d6e60'
    )}
    <div class="body" style="padding:40px 48px;">
      <p class="greeting">Hi <strong>${name}</strong>,</p>
      <p class="copy">
        ${isUrgent
          ? `Your free trial of Cittaa <strong>ends today</strong>. If there's a check-in or consultation you've been thinking about, today's a good day.`
          : `Just a gentle reminder — your free trial with <strong>${companyName}</strong> ends in <strong>${daysLeft} days</strong> on <strong>${endStr}</strong>.`
        }
      </p>

      <div class="banner ${isUrgent ? 'banner-warm' : 'banner-info'}">
        ${isUrgent
          ? '💛 No pressure, but a quick wellness check-in takes less than 10 minutes and can be really insightful.'
          : `🌿 You have <strong>${daysLeft} day${daysLeft !== 1 ? 's' : ''}</strong> left. Consider booking a consultation or doing a voice check-in.`
        }
      </div>

      <div class="btn-wrap" style="text-align:center;margin:32px 0;">
        <a href="${loginUrl}" class="btn" style="background: linear-gradient(135deg, ${isUrgent ? C.warm : C.primary}, ${isUrgent ? '#8a4520' : '#2d6e60'});">Open My Dashboard →</a>
      </div>

      <p style="font-size:12.5px; color:${C.muted}; text-align:center; line-height:1.7;">
        To continue after the trial, ask your HR admin about the next steps.
        Your wellbeing data is always yours — it won't be deleted.
      </p>
    </div>
    ${makeFooter()}
  `);

  return sendEmail({ to, subject, html, text: `Trial ending in ${daysLeft} days — ${loginUrl}` });
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * ASSESSMENT INVITATION                                                        *
 * ─────────────────────────────────────────────────────────────────────────── */
async function sendAssessmentInvite({ employee, clinicianName, assessmentUrl, scheduledAt }) {
  const subject = `A wellness check-in has been arranged for you`;
  const scheduledDate = new Date(scheduledAt).toLocaleString('en-IN', {
    dateStyle: 'long', timeStyle: 'short', timeZone: 'Asia/Kolkata'
  });

  const html = wrapHtml(`
    ${makeHeader('A wellness check-in, just for you', `Arranged by ${clinicianName}`)}
    <div class="body" style="padding:40px 48px;">
      <p class="greeting">Hi <strong>${employee.firstName}</strong>,</p>
      <p class="copy">
        <strong>${clinicianName}</strong> has arranged a VocaCore™ voice wellness check-in for you.
        It takes just 5–10 minutes — you'll speak naturally for a minute or two, and our system
        gently analyses your voice for wellbeing patterns. No right or wrong answers.
      </p>

      <div class="card">
        <div class="card-row"><span class="lbl">Scheduled for</span><span class="val">${scheduledDate} IST</span></div>
        <div class="card-row"><span class="lbl">Duration</span><span class="val">5 – 10 minutes</span></div>
        <div class="card-row"><span class="lbl">What happens</span><span class="val">Voice analysis (private & encrypted)</span></div>
      </div>

      <div class="banner banner-info">
        🎙️ <strong>A quiet space helps:</strong> Find somewhere you feel comfortable,
        ensure your microphone is working, and speak as naturally as you would in conversation.
      </div>

      <div class="btn-wrap" style="text-align:center;margin:32px 0;">
        <a href="${assessmentUrl}" class="btn" style="background: linear-gradient(135deg, ${C.primary}, #2d6e60);">Begin Check-in →</a>
      </div>

      <p style="font-size:12.5px; color:${C.muted}; text-align:center; line-height:1.7;">
        Your results are private and shared only with your care team.
        If you have any concerns, reach out to ${clinicianName} directly.
      </p>
    </div>
    ${makeFooter()}
  `);

  return sendEmail({
    to: employee.email, subject, html,
    text: `Wellness check-in from ${clinicianName}\nScheduled: ${scheduledDate}\nLink: ${assessmentUrl}`
  });
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * ALERT NOTIFICATION                                                           *
 * ─────────────────────────────────────────────────────────────────────────── */
async function sendAlertNotification({ to, alert, employee, tenantName }) {
  const level      = alert.alertLevel || 'high';
  const isCritical = level === 'critical';
  const subject    = isCritical
    ? `[Urgent] Wellbeing concern — ${employee.firstName} ${employee.lastName}`
    : `Wellbeing alert — ${employee.firstName} ${employee.lastName} · ${tenantName}`;

  const html = wrapHtml(`
    ${makeHeader(
      isCritical ? 'Urgent Wellbeing Alert' : 'Wellbeing Alert',
      `${tenantName} — requires your attention`,
      isCritical ? C.danger : C.warm,
      isCritical ? '#7a2e28' : '#8a4520'
    )}
    <div class="body" style="padding:40px 48px;">
      <p class="greeting">This alert was generated for one of your employees.</p>

      <div class="card">
        <div class="card-row"><span class="lbl">Employee</span><span class="val">${employee.firstName} ${employee.lastName}</span></div>
        <div class="card-row"><span class="lbl">Priority</span>
          <span class="val"><span class="tag tag-${level}">${level.toUpperCase()}</span></span>
        </div>
        ${(alert.triggeringScores || []).length > 0 ? `
        <div class="card-row" style="flex-direction:column; align-items:flex-start; gap:6px;">
          <span class="lbl">Indicators</span>
          <span class="val" style="text-align:left;">${(alert.triggeringScores || []).join(' · ')}</span>
        </div>` : ''}
      </div>

      <div class="banner ${isCritical ? 'banner-alert' : 'banner-warm'}">
        ${isCritical
          ? '🔴 <strong>Please review promptly.</strong> This indicator suggests this person may benefit from immediate support. Approach with care and confidentiality.'
          : '🟡 <strong>Recommended action:</strong> Review the assessment and consider whether a follow-up or consultation would be helpful.'
        }
      </div>

      <div class="btn-wrap" style="text-align:center;margin:32px 0;">
        <a href="${PLATFORM_URL}/alerts/${alert._id}" class="btn" style="background: linear-gradient(135deg, ${isCritical ? C.danger : C.warm}, ${isCritical ? '#7a2e28' : '#8a4520'});">Review Alert →</a>
      </div>

      <p style="font-size:12.5px; color:${C.muted}; text-align:center; line-height:1.7;">
        Handle this information with sensitivity and in accordance with your safeguarding policies.
        This alert is confidential.
      </p>
    </div>
    ${makeFooter()}
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
  const subject = `Your wellness consultation is confirmed ✨`;
  const when    = new Date(consultation.scheduledAt).toLocaleString('en-IN', {
    dateStyle: 'full', timeStyle: 'short', timeZone: 'Asia/Kolkata'
  });

  const html = wrapHtml(`
    ${makeHeader('Your consultation is confirmed ✨', 'A space set aside just for you')}
    <div class="body" style="padding:40px 48px;">
      <p class="greeting">Everything is set for your upcoming session.</p>
      <p class="copy">
        Your wellness consultation has been confirmed. This is a private, supportive space —
        feel free to bring whatever's on your mind.
      </p>

      <div class="card">
        <div class="card-row"><span class="lbl">When</span><span class="val">${when} IST</span></div>
        <div class="card-row"><span class="lbl">Duration</span><span class="val">${consultation.durationMinutes || 30} minutes</span></div>
        <div class="card-row"><span class="lbl">Format</span>
          <span class="val">${consultation.mode === 'online' ? 'Online · Google Meet' : `In-person${consultation.location ? ` · ${consultation.location}` : ''}`}</span>
        </div>
      </div>

      ${consultation.mode === 'online' ? `
      <div class="banner banner-info">
        💡 <strong>A few things that help:</strong> Find a quiet, private space.
        A glass of water nearby can be nice. No need to prepare anything specific — just show up.
      </div>` : ''}

      <div class="btn-wrap" style="text-align:center;margin:32px 0;">
        ${meetLink ? `<a href="${meetLink}" class="btn" style="background: linear-gradient(135deg, ${C.primary}, #2d6e60); margin-right:8px;">Join Meeting →</a>` : ''}
        ${calendarLink ? `<a href="${calendarLink}" class="btn-outline">Add to Calendar</a>` : ''}
      </div>

      <p style="font-size:12.5px; color:${C.muted}; text-align:center; line-height:1.7;">
        Need to reschedule? Please let your clinician know as early as possible.
        We understand — life happens.
      </p>
    </div>
    ${makeFooter()}
  `);

  return sendEmail({
    to, subject, html,
    text: `Consultation confirmed: ${when} IST${meetLink ? `\nJoin: ${meetLink}` : ''}`
  });
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * PASSWORD RESET                                                               *
 * ─────────────────────────────────────────────────────────────────────────── */
async function sendPasswordReset({ to, name, resetUrl, expiresIn }) {
  const subject = `Reset your Cittaa password`;
  const expiry  = typeof expiresIn === 'number' ? `${expiresIn} minutes` : expiresIn;

  const html = wrapHtml(`
    ${makeHeader('Reset your password', 'Follow the link below — it only takes a moment')}
    <div class="body" style="padding:40px 48px;">
      <p class="greeting">Hi <strong>${name}</strong>,</p>
      <p class="copy">
        We received a request to reset your password. Click the button below and
        you'll be set up with a new one in seconds.
      </p>

      <div class="btn-wrap" style="text-align:center;margin:32px 0;">
        <a href="${resetUrl}" class="btn" style="background: linear-gradient(135deg, ${C.primary}, #2d6e60);">Reset Password →</a>
      </div>

      <div class="card">
        <div class="card-row"><span class="lbl">Link expires in</span><span class="val">${expiry}</span></div>
      </div>

      <div class="banner banner-lavender">
        🔒 <strong>Didn't ask for this?</strong> No worries — just ignore this email.
        Your password won't change. If you're concerned, contact your administrator.
      </div>
    </div>
    ${makeFooter()}
  `);

  return sendEmail({
    to, subject, html,
    text: `Password reset for ${name}: ${resetUrl}\nExpires: ${expiry}`
  });
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * WEEKLY HR REPORT                                                             *
 * ─────────────────────────────────────────────────────────────────────────── */
async function sendWeeklyHRReport({ to, hrAdmin, reportData, tenantName }) {
  const subject = `Weekly wellbeing pulse — ${tenantName}`;
  const dateStr = new Date().toLocaleDateString('en-IN', { dateStyle: 'long' });

  const alertRows = (reportData.recentAlerts || []).slice(0, 5).map(a => `
    <tr style="border-bottom:1px solid ${C.border};">
      <td style="padding:11px 0; font-size:13.5px; color:${C.text};">${a.employeeName}</td>
      <td style="padding:11px 0; font-size:13.5px;"><span class="tag tag-${a.level}">${a.level?.toUpperCase()}</span></td>
      <td style="padding:11px 0; font-size:13.5px; color:${C.muted};">${a.status}</td>
    </tr>`).join('');

  const html = wrapHtml(`
    ${makeHeader(`Weekly Wellbeing Pulse`, `${tenantName} · ${dateStr}`)}
    <div class="body" style="padding:40px 48px;">
      <p class="greeting">Hi <strong>${hrAdmin.firstName}</strong>,</p>
      <p class="copy">Here's a gentle overview of wellbeing activity across your organisation this week.</p>

      <div class="stat-row">
        <div class="stat-pill">
          <div class="stat-num">${reportData.totalAssessments || 0}</div>
          <div class="stat-lbl">Check-ins</div>
        </div>
        <div class="stat-pill">
          <div class="stat-num">${reportData.activeAlerts || 0}</div>
          <div class="stat-lbl">Active Alerts</div>
        </div>
        <div class="stat-pill">
          <div class="stat-num">${reportData.avgWellnessScore || '—'}</div>
          <div class="stat-lbl">Avg Wellness</div>
        </div>
      </div>

      ${alertRows ? `
        <h3 style="font-size:14px; font-weight:600; color:${C.text}; margin-bottom:4px;">Recent Alerts</h3>
        <table style="width:100%; border-collapse:collapse; margin:12px 0 24px;">
          <thead>
            <tr style="border-bottom:2px solid ${C.border};">
              <th style="text-align:left; padding-bottom:10px; font-size:12px; color:${C.primary}; font-weight:600;">Employee</th>
              <th style="text-align:left; padding-bottom:10px; font-size:12px; color:${C.primary}; font-weight:600;">Level</th>
              <th style="text-align:left; padding-bottom:10px; font-size:12px; color:${C.primary}; font-weight:600;">Status</th>
            </tr>
          </thead>
          <tbody>${alertRows}</tbody>
        </table>` : ''}

      <div class="btn-wrap" style="text-align:center;margin:32px 0;">
        <a href="${PLATFORM_URL}/hr/analytics" class="btn" style="background: linear-gradient(135deg, ${C.primary}, #2d6e60);">View Full Dashboard →</a>
      </div>

      <p style="font-size:12.5px; color:${C.muted}; text-align:center; line-height:1.7;">
        Remember — behind every data point is a person. Thanks for caring about your team. 💚
      </p>
    </div>
    ${makeFooter()}
  `);

  return sendEmail({ to, subject, html, text: `Weekly report — ${tenantName}\nAssessments: ${reportData.totalAssessments || 0}` });
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * CONSULTATION REMINDER                                                        *
 * ─────────────────────────────────────────────────────────────────────────── */
async function sendConsultationReminder({ to, consultation, minutesBefore }) {
  const subject = `Your session starts in ${minutesBefore} minutes 🕐`;
  const time    = new Date(consultation.scheduledAt).toLocaleTimeString('en-IN', {
    timeStyle: 'short', timeZone: 'Asia/Kolkata'
  });

  const html = wrapHtml(`
    ${makeHeader(`Starting in ${minutesBefore} min`, `${time} IST`)}
    <div class="body" style="padding:40px 48px;">
      <p class="greeting">Your session is about to begin.</p>
      <div class="banner banner-info">
        🌿 Take a slow breath, find somewhere comfortable, and join when you're ready.
      </div>
      ${consultation.meetLink ? `
      <div class="btn-wrap" style="text-align:center;margin:32px 0;">
        <a href="${consultation.meetLink}" class="btn" style="background: linear-gradient(135deg, ${C.primary}, #2d6e60);">Join Now →</a>
      </div>` : ''}
      <p style="font-size:12.5px; color:${C.muted}; text-align:center; line-height:1.7;">
        ${consultation.location ? `In-person at: ${consultation.location}` : 'There\'s no rush — take your time joining.'}
      </p>
    </div>
    ${makeFooter()}
  `);

  return sendEmail({ to, subject, html, text: `Session in ${minutesBefore} min${consultation.meetLink ? `\n${consultation.meetLink}` : ''}` });
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * ALERT ESCALATION                                                             *
 * ─────────────────────────────────────────────────────────────────────────── */
async function sendAlertEscalationNotification({ to, alert, employee, reason }) {
  const subject = `[Escalated] Wellbeing concern — ${employee.firstName} ${employee.lastName}`;

  const html = wrapHtml(`
    ${makeHeader('Alert Escalated to You', 'Requires your immediate, careful attention', C.danger, '#7a2e28')}
    <div class="body" style="padding:40px 48px;">
      <div class="banner banner-alert">
        🔴 <strong>This alert has been escalated.</strong> Please review and respond
        according to your organisation's safeguarding and duty-of-care protocols.
      </div>

      <div class="card">
        <div class="card-row"><span class="lbl">Employee</span><span class="val">${employee.firstName} ${employee.lastName}</span></div>
        <div class="card-row"><span class="lbl">Alert level</span><span class="val"><span class="tag tag-critical">CRITICAL</span></span></div>
        <div class="card-row"><span class="lbl">Reason escalated</span><span class="val">${reason}</span></div>
      </div>

      <div class="btn-wrap" style="text-align:center;margin:32px 0;">
        <a href="${PLATFORM_URL}/alerts/${alert._id}" class="btn" style="background: linear-gradient(135deg, ${C.danger}, #7a2e28);">Review Case →</a>
      </div>

      <p style="font-size:12.5px; color:${C.muted}; text-align:center; line-height:1.7;">
        Treat this information with full confidentiality.
        The person behind this data deserves your care and discretion.
      </p>
    </div>
    ${makeFooter()}
  `);

  return sendEmail({ to, subject, html, text: `ESCALATED: ${employee.firstName} ${employee.lastName}\n${PLATFORM_URL}/alerts/${alert._id}` });
}

/* ─────────────────────────────────────────────────────────────────────────── */
module.exports = {
  sendEmail,
  sendWelcomeEmail,
  sendTrialInvite,
  sendTrialExpiryReminder,
  sendAssessmentInvite,
  sendAlertNotification,
  sendConsultationInvite,
  sendPasswordReset,
  sendWeeklyHRReport,
  sendConsultationReminder,
  sendAlertEscalationNotification,
};
