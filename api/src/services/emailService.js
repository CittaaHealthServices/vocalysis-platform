/**
 * EmailService — Cittaa Health Services · Vocalysis Platform
 *
 * ✦ Fully inline-CSS emails — renders correctly in Gmail, Outlook, Apple Mail
 * ✦ Cittaa brand kit: purple family: #7c6fe0 primary · #a896e8 accent · #4e3dbf deep
 * ✦ Mental-health-sensitive copy: calm, warm, non-clinical
 */
const logger = require('../utils/logger');

let _resend = null;
function getResend() {
  if (!_resend) {
    const { Resend } = require('resend');
    const key = process.env.RESEND_API_KEY;
    if (!key) { logger.warn('RESEND_API_KEY not set — emails will be skipped'); return null; }
    _resend = new Resend(key);
  }
  return _resend;
}

/* ── Cittaa brand tokens ──────────────────────────────────────────────────── */
const B = {
  primary:   '#7c6fe0',
  primaryDk: '#4e3dbf',
  accent:    '#a896e8',
  accentDk:  '#6b55d4',
  warm:      '#c27d5a',
  warmDk:    '#8a4520',
  danger:    '#c0544a',
  dangerDk:  '#7a2e28',
  text:      '#2d3748',
  muted:     '#718096',
  mutedLt:   '#a0aec0',
  surface:   '#f5f3fb',
  border:    '#e4dff5',
  white:     '#ffffff',
  bodyBg:    '#f0eefb',
};

const FROM_EMAIL   = process.env.RESEND_FROM_EMAIL || 'info@cittaa.in';
const BRAND_NAME   = 'Cittaa Health Services';
const PLATFORM_URL = process.env.PLATFORM_URL || 'https://striking-bravery-production-c13e.up.railway.app';

/* ── Building blocks (all inline CSS for Gmail compatibility) ─────────────── */

function mkHeader(title, subtitle, from, to2) {
  if (!from) from = B.primary;
  if (!to2)  to2  = B.primaryDk;
  return `
<tr><td style="background:linear-gradient(140deg,${from} 0%,${to2} 100%);padding:44px 48px 40px;">
  <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
    <tr>
      <td style="width:38px;height:38px;background:rgba(255,255,255,0.22);border:1.5px solid rgba(255,255,255,0.35);border-radius:10px;text-align:center;vertical-align:middle;">
        <span style="font-size:18px;font-weight:900;color:#ffffff;font-family:Georgia,serif;display:block;line-height:38px;">C</span>
      </td>
      <td style="padding-left:10px;vertical-align:middle;">
        <span style="font-size:14px;font-weight:700;color:rgba(255,255,255,0.92);font-family:Georgia,serif;letter-spacing:0.3px;">Cittaa &nbsp;&middot;&nbsp; ${BRAND_NAME}</span>
      </td>
    </tr>
  </table>
  <h1 style="margin:0;font-size:25px;font-weight:700;color:#ffffff;line-height:1.3;font-family:Georgia,serif;letter-spacing:-0.3px;">${title}</h1>
  ${subtitle ? `<p style="margin:8px 0 0;font-size:14px;color:rgba(255,255,255,0.75);line-height:1.55;">${subtitle}</p>` : ''}
</td></tr>`;
}

function mkFooter() {
  return `
<tr><td style="background:${B.surface};border-top:1px solid ${B.border};padding:28px 48px;text-align:center;">
  <p style="margin:0 0 4px;font-size:20px;">&#127807;</p>
  <p style="margin:0;font-size:12px;color:${B.muted};line-height:1.9;">
    Sent with care by <strong style="color:${B.primary};font-family:Georgia,serif;">Cittaa Health Services</strong>
  </p>
  <p style="margin:4px 0 0;font-size:12px;color:${B.muted};">
    Powered by <strong style="color:${B.primary};font-family:Georgia,serif;">VocaCore&trade;</strong> &nbsp;&middot;&nbsp;
    <a href="${PLATFORM_URL}" style="color:${B.primary};text-decoration:none;">Open Platform</a>
  </p>
  <p style="margin:10px 0 0;font-size:11px;color:${B.mutedLt};line-height:1.7;">
    &copy; ${new Date().getFullYear()} Cittaa Health Services. All rights reserved.<br>
    This is an automated message &mdash; please do not reply directly.
  </p>
</td></tr>`;
}

function mkCard(rows) {
  const rowsHtml = rows.map((r, i) => `
<tr>
  <td style="padding:10px 16px 10px 0;font-size:13.5px;color:${B.muted};font-weight:500;border-bottom:${i < rows.length - 1 ? `1px solid ${B.border}` : 'none'};">${r.label}</td>
  <td style="padding:10px 0;font-size:13.5px;color:${B.text};font-weight:600;text-align:right;border-bottom:${i < rows.length - 1 ? `1px solid ${B.border}` : 'none'};">${r.value}</td>
</tr>`).join('');
  return `
<tr><td style="background:${B.surface};border:1px solid ${B.border};border-radius:14px;padding:4px 24px;margin:24px 0;display:block;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0">${rowsHtml}</table>
</td></tr>
<tr><td style="height:24px;"></td></tr>`;
}

function mkBanner(type, html) {
  const s = {
    info:    { bg: '#eef6f4', border: B.primary,  color: '#2d6059' },
    warm:    { bg: '#fdf4ee', border: B.warm,      color: '#6b3a20' },
    alert:   { bg: '#fdf2f1', border: B.danger,    color: '#7a2e28' },
    lavender:{ bg: '#f3f1fb', border: B.accent,    color: '#433874' },
    success: { bg: '#edfbf5', border: '#27ae7a',   color: '#1a6048' },
  }[type] || { bg: '#eef6f4', border: B.primary, color: '#2d6059' };
  return `
<tr><td style="background:${s.bg};border-left:4px solid ${s.border};border-radius:12px;padding:15px 20px;font-size:13.5px;line-height:1.7;color:${s.color};margin:20px 0;display:block;">
  ${html}
</td></tr>
<tr><td style="height:20px;"></td></tr>`;
}

function mkButton(href, label, from, to2) {
  if (!from) from = B.primary;
  if (!to2)  to2  = B.primaryDk;
  return `
<tr><td style="padding:12px 0;text-align:center;">
  <a href="${href}" target="_blank"
     style="display:inline-block;text-decoration:none;font-size:15px;font-weight:700;color:#ffffff;background:linear-gradient(135deg,${from},${to2});padding:15px 38px;border-radius:12px;letter-spacing:0.1px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;mso-padding-alt:0;text-underline-color:${from};">
    <!--[if mso]><i style="letter-spacing:25px;mso-font-width:-100%;mso-text-raise:30pt">&nbsp;</i><![endif]-->
    ${label}
    <!--[if mso]><i style="letter-spacing:25px;mso-font-width:-100%">&nbsp;</i><![endif]-->
  </a>
</td></tr>
<tr><td style="height:20px;"></td></tr>`;
}

function mkStats(stats) {
  const cells = stats.map(s => `
<td style="text-align:center;background:${B.surface};border:1px solid ${B.border};border-radius:14px;padding:18px 12px;">
  <div style="font-size:27px;font-weight:700;color:${B.primary};letter-spacing:-0.5px;font-family:Georgia,serif;line-height:1.1;">${s.value}</div>
  <div style="font-size:11px;color:${B.muted};margin-top:5px;font-weight:500;">${s.label}</div>
</td>`).join('<td style="width:10px;"></td>');
  return `
<tr><td style="padding:0 0 24px;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${cells}</tr></table>
</td></tr>`;
}

function wrapHtml(rows) {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Cittaa Health Services</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
  <style>
    body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
    body{margin:0;padding:0;background:${B.bodyBg}}
    table{border-collapse:collapse!important}
    img{border:0;height:auto;line-height:100%;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic}
    a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important}
    @media only screen and (max-width:600px){
      .email-wrap{width:100%!important;margin:0!important;border-radius:0!important}
      .body-pad td{padding:28px 24px!important}
      h1{font-size:20px!important}
    }
  </style>
</head>
<body style="margin:0;padding:0;background:${B.bodyBg};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr><td style="padding:32px 16px;">
      <table role="presentation" class="email-wrap" align="center" cellpadding="0" cellspacing="0" border="0"
             style="max-width:600px;width:100%;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 32px rgba(74,144,128,0.12),0 1px 6px rgba(0,0,0,0.05);">
        ${rows}
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/* ── Core send ────────────────────────────────────────────────────────────── */
async function sendEmail({ to, subject, html, text }) {
  const resend = getResend();
  if (!resend) {
    logger.warn('Email skipped (no Resend key)', { to, subject });
    return { success: false, skipped: true };
  }
  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to:   Array.isArray(to) ? to : [to],
      subject, html,
      text: text || subject,
    });
    if (error) { logger.error('Resend error', { error, to, subject }); throw new Error(error.message || 'Send failed'); }
    logger.debug('Email sent', { id: data?.id, to, subject });
    return { success: true, id: data?.id };
  } catch (err) {
    logger.error('Failed to send email', { error: err.message, to, subject });
    throw err;
  }
}

/* ════════════════════════════════════════════════════════════════════════════
 * 1. WELCOME EMAIL
 * ════════════════════════════════════════════════════════════════════════════ */
async function sendWelcomeEmail({ to, name, loginUrl, tempPassword, companyName }) {
  const subject = `Welcome to Cittaa — your wellness journey starts today 🌱`;
  const html = wrapHtml(`
    ${mkHeader(`Welcome, ${name} &#127807;`, `Your account is ready at ${companyName}`)}
    <tr class="body-pad"><td style="padding:40px 48px;">
      <p style="margin:0 0 16px;font-size:15px;color:${B.text};line-height:1.75;">Hi <strong>${name}</strong>,</p>
      <p style="margin:0 0 24px;font-size:14.5px;color:#4a5568;line-height:1.8;">
        We're genuinely glad you're here. <strong>${companyName}</strong> has set up your Cittaa wellness account
        &mdash; a private, supportive space to check in with yourself, track your wellbeing,
        and access care whenever you need it.
      </p>
    </td></tr>
    ${mkCard([
      { label: 'Your email',         value: to },
      { label: 'Temporary password', value: `<span style="font-family:'Courier New',monospace;letter-spacing:1.5px;font-size:14px;color:${B.primary};font-weight:700;">${tempPassword}</span>` },
      { label: 'Organisation',       value: companyName },
    ])}
    <tr><td style="padding:0 48px;">
    ${mkBanner('warm', `<strong>One small step:</strong> Log in and set a new password that feels personal to you. Your temporary password expires in <strong>24 hours</strong>.`)}
    </td></tr>
    ${mkButton(loginUrl, 'Sign in to Cittaa &#8594;')}
    <tr><td style="padding:0 48px 16px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="height:1px;background:${B.border};"></td></tr></table>
    </td></tr>
    <tr><td style="padding:0 48px 40px;">
      <p style="margin:0;font-size:13px;color:${B.muted};line-height:1.8;">
        Everything on this platform is confidential. Your data belongs to you &mdash;
        it is never shared without your explicit consent. If you have questions,
        reach out to your HR team or administrator.
      </p>
    </td></tr>
    ${mkFooter()}
  `);
  return sendEmail({ to, subject, html, text: `Welcome to Cittaa!\nEmail: ${to}\nTemp Password: ${tempPassword}\nLogin: ${loginUrl}` });
}

/* ════════════════════════════════════════════════════════════════════════════
 * 2. TRIAL INVITATION
 * ════════════════════════════════════════════════════════════════════════════ */
async function sendTrialInvite({ to, name, companyName, daysLeft, endDate, loginUrl }) {
  const subject = `${companyName} has gifted you a free wellbeing trial &#127873;`;
  const endStr  = new Date(endDate).toLocaleDateString('en-IN', { dateStyle: 'long' });
  const features = [
    { icon: '&#127897;', title: 'Voice Wellness Check-ins',    desc: 'Speak naturally for 30 sec&ndash;2 min. Our AI listens for wellbeing signals &mdash; no transcription, no judgement.' },
    { icon: '&#128202;', title: 'Personal Wellness Dashboard', desc: 'See your emotional trends over time and receive gentle, personalised suggestions.' },
    { icon: '&#128172;', title: '1:1 Support Sessions',        desc: 'Book a private consultation with a qualified clinician or EAP counsellor.' },
    { icon: '&#128218;', title: 'Self-help Resource Library',  desc: 'Guided exercises, stress-management tools, and wellbeing workbooks.' },
  ];
  const featureRows = features.map((f, i) => `
<tr>
  <td style="padding:12px 0;border-bottom:${i < features.length - 1 ? `1px solid ${B.border}` : 'none'};vertical-align:top;width:28px;font-size:20px;">${f.icon}</td>
  <td style="padding:12px 0 12px 14px;border-bottom:${i < features.length - 1 ? `1px solid ${B.border}` : 'none'};vertical-align:top;">
    <div style="font-size:13.5px;font-weight:600;color:${B.text};margin-bottom:2px;">${f.title}</div>
    <div style="font-size:12.5px;color:${B.muted};line-height:1.55;">${f.desc}</div>
  </td>
</tr>`).join('');

  const html = wrapHtml(`
    ${mkHeader(`A gift for you, ${name} &#127873;`, `${daysLeft}-day free trial from ${companyName}`, B.accent, B.accentDk)}
    <tr><td style="padding:40px 48px 0;">
      <p style="margin:0 0 16px;font-size:15px;color:${B.text};line-height:1.75;">Hi <strong>${name}</strong>,</p>
      <p style="margin:0 0 20px;font-size:14.5px;color:#4a5568;line-height:1.8;">
        <strong>${companyName}</strong> cares about your wellbeing and has given you
        <strong>${daysLeft} days of completely free access</strong> to the Cittaa wellness platform.
        No payment, no commitment &mdash; just support, whenever you want it.
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f3fb;border:1px solid #ddd8f5;border-radius:14px;margin-bottom:20px;">
        <tr><td style="padding:8px 24px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">${featureRows}</table>
        </td></tr>
      </table>
    </td></tr>
    ${mkCard([
      { label: 'Trial duration',     value: `${daysLeft} days &mdash; completely free` },
      { label: 'Access expires',     value: endStr },
      { label: 'Credit card needed', value: `<span style="color:${B.primary};font-weight:700;">No &mdash; not required</span>` },
    ])}
    ${mkButton(loginUrl, 'Begin My Free Trial &#8594;', B.accent, B.accentDk)}
    <tr><td style="padding:0 48px 40px;text-align:center;">
      <p style="margin:0;font-size:12.5px;color:${B.muted};line-height:1.7;">
        Trial ends on <strong>${endStr}</strong>. After that, talk to your HR team about continuing.
        Everything you share is strictly confidential.
      </p>
    </td></tr>
    ${mkFooter()}
  `);
  return sendEmail({ to, subject, html, text: `${companyName} has given you a ${daysLeft}-day free Cittaa trial!\nLogin: ${loginUrl}\nExpires: ${endStr}` });
}

/* ════════════════════════════════════════════════════════════════════════════
 * 3. TRIAL EXPIRY REMINDER
 * ════════════════════════════════════════════════════════════════════════════ */
async function sendTrialExpiryReminder({ to, name, companyName, daysLeft, endDate, loginUrl }) {
  const subject = daysLeft <= 1
    ? `Your Cittaa trial ends today &mdash; last chance to check in &#128336;`
    : `${daysLeft} days left in your Cittaa trial &mdash; ${companyName}`;
  const endStr   = new Date(endDate).toLocaleDateString('en-IN', { dateStyle: 'long' });
  const isUrgent = daysLeft <= 2;
  const hFrom    = isUrgent ? B.warm   : B.primary;
  const hTo      = isUrgent ? B.warmDk : B.primaryDk;

  const html = wrapHtml(`
    ${mkHeader(
      isUrgent ? `Trial ends ${daysLeft <= 1 ? 'today' : 'very soon'} &#128336;` : `${daysLeft} days of trial left`,
      `Make the most of your access before ${endStr}`,
      hFrom, hTo
    )}
    <tr><td style="padding:40px 48px 0;">
      <p style="margin:0 0 16px;font-size:15px;color:${B.text};line-height:1.75;">Hi <strong>${name}</strong>,</p>
      <p style="margin:0 0 24px;font-size:14.5px;color:#4a5568;line-height:1.8;">
        ${isUrgent
          ? `Your free trial of Cittaa <strong>ends today</strong>. If there's a check-in or consultation you've been thinking about, today's a good day.`
          : `Just a gentle reminder &mdash; your free trial with <strong>${companyName}</strong> ends in <strong>${daysLeft} days</strong> on <strong>${endStr}</strong>.`
        }
      </p>
    </td></tr>
    <tr><td style="padding:0 48px;">
    ${mkBanner(isUrgent ? 'warm' : 'info',
      isUrgent
        ? '&#128155; No pressure, but a quick wellness check-in takes less than 10 minutes and can be really insightful.'
        : `&#127807; You have <strong>${daysLeft} day${daysLeft !== 1 ? 's' : ''}</strong> left. Consider booking a consultation or doing a voice check-in.`
    )}
    </td></tr>
    ${mkButton(loginUrl, 'Open My Dashboard &#8594;', hFrom, hTo)}
    <tr><td style="padding:0 48px 40px;text-align:center;">
      <p style="margin:0;font-size:12.5px;color:${B.muted};line-height:1.7;">
        To continue after the trial, ask your HR admin about the next steps.
        Your wellbeing data is always yours &mdash; it won't be deleted.
      </p>
    </td></tr>
    ${mkFooter()}
  `);
  return sendEmail({ to, subject, html, text: `Trial ending in ${daysLeft} days &mdash; ${loginUrl}` });
}

/* ════════════════════════════════════════════════════════════════════════════
 * 4. ASSESSMENT INVITATION
 * ════════════════════════════════════════════════════════════════════════════ */
async function sendAssessmentInvite({ employee, clinicianName, assessmentUrl, scheduledAt }) {
  const subject = `A wellness check-in has been arranged for you`;
  const scheduledDate = new Date(scheduledAt).toLocaleString('en-IN', {
    dateStyle: 'long', timeStyle: 'short', timeZone: 'Asia/Kolkata',
  });
  const html = wrapHtml(`
    ${mkHeader('A wellness check-in, just for you', `Arranged by ${clinicianName}`)}
    <tr><td style="padding:40px 48px 0;">
      <p style="margin:0 0 16px;font-size:15px;color:${B.text};line-height:1.75;">Hi <strong>${employee.firstName}</strong>,</p>
      <p style="margin:0 0 24px;font-size:14.5px;color:#4a5568;line-height:1.8;">
        <strong>${clinicianName}</strong> has arranged a VocaCore&trade; voice wellness check-in for you.
        It takes just 5&ndash;10 minutes &mdash; you'll speak naturally for a minute or two,
        and our system gently analyses your voice for wellbeing patterns. No right or wrong answers.
      </p>
    </td></tr>
    ${mkCard([
      { label: 'Scheduled for', value: `${scheduledDate} IST` },
      { label: 'Duration',      value: '5 &ndash; 10 minutes' },
      { label: 'What happens',  value: 'Voice analysis (private &amp; encrypted)' },
    ])}
    <tr><td style="padding:0 48px;">
    ${mkBanner('info', `&#127897; <strong>A quiet space helps:</strong> Find somewhere you feel comfortable, ensure your microphone is working, and speak as naturally as you would in conversation.`)}
    </td></tr>
    ${mkButton(assessmentUrl, 'Begin Check-in &#8594;')}
    <tr><td style="padding:0 48px 40px;text-align:center;">
      <p style="margin:0;font-size:12.5px;color:${B.muted};line-height:1.7;">
        Your results are private and shared only with your care team.
        If you have any concerns, reach out to ${clinicianName} directly.
      </p>
    </td></tr>
    ${mkFooter()}
  `);
  return sendEmail({ to: employee.email, subject, html, text: `Wellness check-in from ${clinicianName}\nScheduled: ${scheduledDate}\nLink: ${assessmentUrl}` });
}

/* ════════════════════════════════════════════════════════════════════════════
 * 5. ALERT NOTIFICATION
 * ════════════════════════════════════════════════════════════════════════════ */
async function sendAlertNotification({ to, alert, employee, tenantName }) {
  const level      = alert.alertLevel || 'high';
  const isCritical = level === 'critical';
  const subject    = isCritical
    ? `[Urgent] Wellbeing concern &mdash; ${employee.firstName} ${employee.lastName}`
    : `Wellbeing alert &mdash; ${employee.firstName} ${employee.lastName} &middot; ${tenantName}`;
  const tagBgs   = { critical:'#fde8e7', high:'#fef3e2', medium:'#fef9c3', low:'#e6f4f1' };
  const tagColor = { critical:'#9b2c2c', high:'#92400e', medium:'#713f12', low:'#1a5c4d' };
  const tagHtml  = `<span style="display:inline-block;padding:3px 10px;border-radius:99px;font-size:12px;font-weight:700;background:${tagBgs[level]||'#e2e8f0'};color:${tagColor[level]||'#4a5568'};">${level.toUpperCase()}</span>`;

  const rows = [
    { label: 'Employee', value: `${employee.firstName} ${employee.lastName}` },
    { label: 'Priority', value: tagHtml },
  ];
  if ((alert.triggeringScores || []).length > 0) {
    rows.push({ label: 'Indicators', value: alert.triggeringScores.join(' &middot; ') });
  }
  const html = wrapHtml(`
    ${mkHeader(
      isCritical ? 'Urgent Wellbeing Alert' : 'Wellbeing Alert',
      `${tenantName} &mdash; requires your attention`,
      isCritical ? B.danger : B.warm,
      isCritical ? B.dangerDk : B.warmDk,
    )}
    <tr><td style="padding:40px 48px 0;">
      <p style="margin:0 0 20px;font-size:14.5px;color:#4a5568;line-height:1.8;">This alert was generated for one of your team members.</p>
    </td></tr>
    ${mkCard(rows)}
    <tr><td style="padding:0 48px;">
    ${mkBanner(isCritical ? 'alert' : 'warm',
      isCritical
        ? '&#128308; <strong>Please review promptly.</strong> This indicator suggests this person may benefit from immediate support. Approach with care and confidentiality.'
        : '&#128993; <strong>Recommended action:</strong> Review the assessment and consider whether a follow-up or consultation would be helpful.'
    )}
    </td></tr>
    ${mkButton(`${PLATFORM_URL}/alerts/${alert._id}`, 'Review Alert &#8594;', isCritical ? B.danger : B.warm, isCritical ? B.dangerDk : B.warmDk)}
    <tr><td style="padding:0 48px 40px;text-align:center;">
      <p style="margin:0;font-size:12.5px;color:${B.muted};line-height:1.7;">
        Handle this information with sensitivity and in accordance with your safeguarding policies.
      </p>
    </td></tr>
    ${mkFooter()}
  `);
  return sendEmail({ to, subject, html, text: `[${level.toUpperCase()}] Alert for ${employee.firstName} ${employee.lastName}\n${PLATFORM_URL}/alerts/${alert._id}` });
}

/* ════════════════════════════════════════════════════════════════════════════
 * 6. CONSULTATION INVITE
 * ════════════════════════════════════════════════════════════════════════════ */
async function sendConsultationInvite({ to, consultation, meetLink, calendarLink }) {
  const subject = `Your wellness consultation is confirmed &#10024;`;
  const when    = new Date(consultation.scheduledAt).toLocaleString('en-IN', {
    dateStyle: 'full', timeStyle: 'short', timeZone: 'Asia/Kolkata',
  });
  const html = wrapHtml(`
    ${mkHeader('Your consultation is confirmed &#10024;', 'A space set aside just for you')}
    <tr><td style="padding:40px 48px 0;">
      <p style="margin:0 0 16px;font-size:15px;color:${B.text};line-height:1.75;">Everything is set for your upcoming session.</p>
      <p style="margin:0 0 24px;font-size:14.5px;color:#4a5568;line-height:1.8;">
        Your wellness consultation has been confirmed. This is a private, supportive space &mdash;
        feel free to bring whatever's on your mind.
      </p>
    </td></tr>
    ${mkCard([
      { label: 'When',     value: `${when} IST` },
      { label: 'Duration', value: `${consultation.durationMinutes || 30} minutes` },
      { label: 'Format',   value: consultation.mode === 'online' ? 'Online &middot; Google Meet' : `In-person${consultation.location ? ` &middot; ${consultation.location}` : ''}` },
    ])}
    ${consultation.mode === 'online' ? `<tr><td style="padding:0 48px;">${mkBanner('info', '&#128161; <strong>A few things that help:</strong> Find a quiet, private space. A glass of water nearby can be nice. No need to prepare anything &mdash; just show up.')}</td></tr>` : ''}
    ${meetLink ? mkButton(meetLink, 'Join Meeting &#8594;') : ''}
    ${calendarLink ? `<tr><td style="padding:0 48px 8px;text-align:center;"><a href="${calendarLink}" style="display:inline-block;text-decoration:none;font-size:14px;font-weight:600;color:${B.primary};border:1.5px solid ${B.primary};padding:11px 26px;border-radius:12px;">Add to Calendar</a></td></tr>` : ''}
    <tr><td style="padding:8px 48px 40px;text-align:center;">
      <p style="margin:0;font-size:12.5px;color:${B.muted};line-height:1.7;">
        Need to reschedule? Please let your clinician know as early as possible. We understand &mdash; life happens.
      </p>
    </td></tr>
    ${mkFooter()}
  `);
  return sendEmail({ to, subject, html, text: `Consultation confirmed: ${when} IST${meetLink ? `\nJoin: ${meetLink}` : ''}` });
}

/* ════════════════════════════════════════════════════════════════════════════
 * 7. PASSWORD RESET
 * ════════════════════════════════════════════════════════════════════════════ */
async function sendPasswordReset({ to, name, resetUrl, expiresIn }) {
  const subject = `Reset your Cittaa password`;
  const expiry  = typeof expiresIn === 'number' ? `${expiresIn} minutes` : (expiresIn || '30 minutes');
  const html = wrapHtml(`
    ${mkHeader('Reset your password', 'Follow the link below &mdash; it only takes a moment')}
    <tr><td style="padding:40px 48px 0;">
      <p style="margin:0 0 16px;font-size:15px;color:${B.text};line-height:1.75;">Hi <strong>${name}</strong>,</p>
      <p style="margin:0 0 24px;font-size:14.5px;color:#4a5568;line-height:1.8;">
        We received a request to reset your password. Click the button below and
        you'll be set up with a new one in seconds.
      </p>
    </td></tr>
    ${mkButton(resetUrl, 'Reset Password &#8594;')}
    ${mkCard([{ label: 'Link expires in', value: expiry }])}
    <tr><td style="padding:0 48px 40px;">
    ${mkBanner('lavender', '&#128274; <strong>Didn\'t request this?</strong> No worries &mdash; just ignore this email. Your password won\'t change. If you\'re concerned, contact your administrator.')}
    </td></tr>
    ${mkFooter()}
  `);
  return sendEmail({ to, subject, html, text: `Password reset for ${name}: ${resetUrl}\nExpires in: ${expiry}` });
}

/* ════════════════════════════════════════════════════════════════════════════
 * 8. WEEKLY HR REPORT
 * ════════════════════════════════════════════════════════════════════════════ */
async function sendWeeklyHRReport({ to, hrAdmin, reportData, tenantName }) {
  const subject  = `Weekly wellbeing pulse &mdash; ${tenantName}`;
  const dateStr  = new Date().toLocaleDateString('en-IN', { dateStyle: 'long' });
  const tagBgs   = { critical:'#fde8e7', high:'#fef3e2', medium:'#fef9c3', low:'#e6f4f1' };
  const tagColor = { critical:'#9b2c2c', high:'#92400e', medium:'#713f12', low:'#1a5c4d' };

  const alertRows = (reportData.recentAlerts || []).slice(0, 5).map((a, i) => `
<tr>
  <td style="padding:11px 16px 11px 0;font-size:13.5px;color:${B.text};border-bottom:1px solid ${B.border};">${a.employeeName}</td>
  <td style="padding:11px 8px;font-size:13.5px;border-bottom:1px solid ${B.border};">
    <span style="display:inline-block;padding:3px 10px;border-radius:99px;font-size:11px;font-weight:700;background:${tagBgs[a.level]||'#e2e8f0'};color:${tagColor[a.level]||'#4a5568'};">${(a.level||'').toUpperCase()}</span>
  </td>
  <td style="padding:11px 0;font-size:13.5px;color:${B.muted};border-bottom:1px solid ${B.border};">${a.status}</td>
</tr>`).join('');

  const html = wrapHtml(`
    ${mkHeader('Weekly Wellbeing Pulse', `${tenantName} &middot; ${dateStr}`)}
    <tr><td style="padding:40px 48px 0;">
      <p style="margin:0 0 16px;font-size:15px;color:${B.text};line-height:1.75;">Hi <strong>${hrAdmin.firstName}</strong>,</p>
      <p style="margin:0 0 24px;font-size:14.5px;color:#4a5568;line-height:1.8;">
        Here's a gentle overview of wellbeing activity across your organisation this week.
      </p>
    </td></tr>
    ${mkStats([
      { value: reportData.totalAssessments || 0, label: 'Check-ins' },
      { value: reportData.activeAlerts || 0,     label: 'Active Alerts' },
      { value: reportData.avgWellnessScore || '&mdash;', label: 'Avg Wellness' },
    ])}
    ${alertRows ? `<tr><td style="padding:0 48px;">
      <h3 style="margin:0 0 4px;font-size:14px;font-weight:700;color:${B.text};">Recent Alerts</h3>
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:12px 0 24px;">
        <thead>
          <tr style="border-bottom:2px solid ${B.border};">
            <th style="text-align:left;padding-bottom:10px;font-size:12px;color:${B.primary};font-weight:600;">Employee</th>
            <th style="text-align:left;padding-bottom:10px;font-size:12px;color:${B.primary};font-weight:600;">Level</th>
            <th style="text-align:left;padding-bottom:10px;font-size:12px;color:${B.primary};font-weight:600;">Status</th>
          </tr>
        </thead>
        <tbody>${alertRows}</tbody>
      </table>
    </td></tr>` : ''}
    ${mkButton(`${PLATFORM_URL}/hr/analytics`, 'View Full Dashboard &#8594;')}
    <tr><td style="padding:0 48px 40px;text-align:center;">
      <p style="margin:0;font-size:12.5px;color:${B.muted};line-height:1.7;">
        Remember &mdash; behind every data point is a person. Thanks for caring about your team. &#128154;
      </p>
    </td></tr>
    ${mkFooter()}
  `);
  return sendEmail({ to, subject, html, text: `Weekly report &mdash; ${tenantName}\nCheck-ins: ${reportData.totalAssessments || 0}` });
}

/* ════════════════════════════════════════════════════════════════════════════
 * 9. CONSULTATION REMINDER
 * ════════════════════════════════════════════════════════════════════════════ */
async function sendConsultationReminder({ to, consultation, minutesBefore }) {
  const subject = `Your session starts in ${minutesBefore} minutes &#128336;`;
  const time    = new Date(consultation.scheduledAt).toLocaleTimeString('en-IN', {
    timeStyle: 'short', timeZone: 'Asia/Kolkata',
  });
  const html = wrapHtml(`
    ${mkHeader(`Starting in ${minutesBefore} min`, `${time} IST`)}
    <tr><td style="padding:40px 48px 0;text-align:center;">
      <p style="margin:0 0 20px;font-size:15px;color:${B.text};line-height:1.75;text-align:center;">Your session is about to begin.</p>
    </td></tr>
    <tr><td style="padding:0 48px;">
    ${mkBanner('info', '&#127807; Take a slow breath, find somewhere comfortable, and join when you\'re ready.')}
    </td></tr>
    ${consultation.meetLink ? mkButton(consultation.meetLink, 'Join Now &#8594;') : ''}
    <tr><td style="padding:0 48px 40px;text-align:center;">
      <p style="margin:0;font-size:12.5px;color:${B.muted};line-height:1.7;">
        ${consultation.location ? `In-person at: ${consultation.location}` : `There's no rush &mdash; take your time joining.`}
      </p>
    </td></tr>
    ${mkFooter()}
  `);
  return sendEmail({ to, subject, html, text: `Session in ${minutesBefore} min${consultation.meetLink ? `\n${consultation.meetLink}` : ''}` });
}

/* ════════════════════════════════════════════════════════════════════════════
 * 10. ALERT ESCALATION
 * ════════════════════════════════════════════════════════════════════════════ */
async function sendAlertEscalationNotification({ to, alert, employee, reason }) {
  const subject = `[Escalated] Wellbeing concern &mdash; ${employee.firstName} ${employee.lastName}`;
  const html = wrapHtml(`
    ${mkHeader('Alert Escalated to You', 'Requires your immediate, careful attention', B.danger, B.dangerDk)}
    <tr><td style="padding:40px 48px 0;">
    ${mkBanner('alert', '&#128308; <strong>This alert has been escalated.</strong> Please review and respond according to your organisation\'s safeguarding and duty-of-care protocols.')}
    </td></tr>
    ${mkCard([
      { label: 'Employee',        value: `${employee.firstName} ${employee.lastName}` },
      { label: 'Alert level',     value: `<span style="display:inline-block;padding:3px 10px;border-radius:99px;font-size:12px;font-weight:700;background:#fde8e7;color:#9b2c2c;">CRITICAL</span>` },
      { label: 'Reason escalated', value: reason },
    ])}
    ${mkButton(`${PLATFORM_URL}/alerts/${alert._id}`, 'Review Case &#8594;', B.danger, B.dangerDk)}
    <tr><td style="padding:0 48px 40px;text-align:center;">
      <p style="margin:0;font-size:12.5px;color:${B.muted};line-height:1.7;">
        Treat this information with full confidentiality.
        The person behind this data deserves your care and discretion.
      </p>
    </td></tr>
    ${mkFooter()}
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
