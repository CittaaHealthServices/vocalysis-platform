/**
 * EmailService — Cittaa Health Services · Vocalysis Platform
 *
 * ✦ Fully inline-CSS emails — renders correctly in Gmail, Outlook, Apple Mail
 * ✦ Modern, vibrant brand design with rich typography and visual hierarchy
 * ✦ IST timezone, Indian locale formatting
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

/* ── Brand tokens ────────────────────────────────────────────────────────── */
const B = {
  p900:    '#3b0764',
  p800:    '#6b21a8',
  p700:    '#7e22ce',
  p600:    '#9333ea',
  p500:    '#a855f7',
  p100:    '#f3e8ff',
  p50:     '#faf5ff',
  teal:    '#0d9488',
  tealDk:  '#0f766e',
  amber:   '#d97706',
  amberDk: '#92400e',
  red:     '#dc2626',
  redDk:   '#991b1b',
  green:   '#16a34a',
  greenDk: '#166534',
  text:    '#1e1b4b',
  sub:     '#4b5563',
  muted:   '#6b7280',
  light:   '#9ca3af',
  border:  '#ede9fe',
  surface: '#faf5ff',
  bg:      '#f5f3ff',
  white:   '#ffffff',
};

const FROM_EMAIL   = process.env.RESEND_FROM_EMAIL || 'info@cittaa.in';
const BRAND_NAME   = 'Cittaa Health';
const PLATFORM_URL = process.env.PLATFORM_URL || 'https://app.vocalysis.cittaa.in';
const IST          = 'Asia/Kolkata';

function toISTDate(d)  { return new Date(d).toLocaleDateString ('en-IN', { timeZone: IST, day:'2-digit', month:'short', year:'numeric' }); }
function toISTTime(d)  { return new Date(d).toLocaleTimeString ('en-IN', { timeZone: IST, hour:'2-digit', minute:'2-digit', hour12:true }); }
function toIST(d)      { return new Date(d).toLocaleString     ('en-IN', { timeZone: IST, day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit', hour12:true }); }
function istHour()     { return new Date().toLocaleString       ('en-IN', { timeZone: IST, hour:'numeric', hour12:false }) | 0; }
function isISTBusinessHours() { const h = istHour(); return h >= 8 && h < 20; }

/* ══════════════════════════════════════════════════════════════════════════
   LAYOUT PRIMITIVES
══════════════════════════════════════════════════════════════════════════ */

function mkTopBar() {
  return `
<tr>
  <td style="background:#ffffff;padding:20px 40px 18px;border-bottom:1px solid ${B.border};">
    <table cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="width:34px;height:34px;background:linear-gradient(135deg,${B.p700},${B.p900});border-radius:9px;text-align:center;vertical-align:middle;">
          <span style="font-size:17px;font-weight:900;color:#ffffff;font-family:Georgia,serif;display:block;line-height:34px;letter-spacing:-0.5px;">C</span>
        </td>
        <td style="padding-left:10px;vertical-align:middle;">
          <span style="font-size:16px;font-weight:800;color:${B.p800};font-family:Georgia,'Times New Roman',serif;letter-spacing:-0.3px;">Cittaa</span>
          <span style="font-size:13px;font-weight:500;color:${B.muted};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;margin-left:6px;">Health Services</span>
        </td>
      </tr>
    </table>
  </td>
</tr>`;
}

function mkHero(title, subtitle, { from = B.p700, to = B.p900, emoji = '' } = {}) {
  return `
<tr>
  <td style="background:linear-gradient(135deg,${from} 0%,${to} 100%);padding:52px 40px 48px;overflow:hidden;">
    ${emoji ? `<p style="margin:0 0 16px;font-size:36px;line-height:1;">${emoji}</p>` : ''}
    <h1 style="margin:0 0 10px;font-size:28px;font-weight:800;color:#ffffff;line-height:1.25;font-family:Georgia,'Times New Roman',serif;letter-spacing:-0.5px;">${title}</h1>
    ${subtitle ? `<p style="margin:0;font-size:14.5px;color:rgba(255,255,255,0.78);line-height:1.6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">${subtitle}</p>` : ''}
  </td>
</tr>`;
}

function mkDivider(color = B.border) {
  return `<tr><td style="padding:0 40px;"><div style="height:1px;background:${color};"></div></td></tr><tr><td style="height:8px;"></td></tr>`;
}

function mkInfoCard(rows) {
  const inner = rows.map((r, i) => `
<tr>
  <td style="padding:12px 20px 12px 0;font-size:13px;color:${B.muted};font-weight:600;vertical-align:top;white-space:nowrap;border-bottom:${i < rows.length-1 ? `1px solid ${B.border}` : 'none'};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">${r.label}</td>
  <td style="padding:12px 0;font-size:13.5px;color:${B.text};font-weight:600;text-align:right;border-bottom:${i < rows.length-1 ? `1px solid ${B.border}` : 'none'};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">${r.value}</td>
</tr>`).join('');
  return `
<tr>
  <td style="padding:0 40px 24px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0"
           style="background:${B.surface};border:1.5px solid ${B.border};border-radius:14px;padding:4px 24px;">
      <tr><td style="padding:4px 0;"><table width="100%" cellpadding="0" cellspacing="0" border="0">${inner}</table></td></tr>
    </table>
  </td>
</tr>`;
}

function mkCallout({ type = 'info', html }) {
  const s = {
    info:    { bg:'#eff6ff', border:B.p700,   text:'#1e3a5f' },
    success: { bg:'#f0fdf4', border:B.green,  text:'#14532d' },
    warning: { bg:'#fffbeb', border:B.amber,  text:'#78350f' },
    danger:  { bg:'#fef2f2', border:B.red,    text:'#7f1d1d' },
    purple:  { bg:B.p50,     border:B.p600,   text:B.p900    },
  }[type] || { bg:'#eff6ff', border:B.p700, text:'#1e3a5f' };
  return `
<tr>
  <td style="padding:0 40px 20px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0"
           style="background:${s.bg};border-left:4px solid ${s.border};border-radius:0 12px 12px 0;">
      <tr><td style="padding:14px 20px;font-size:13.5px;line-height:1.7;color:${s.text};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
        ${html}
      </td></tr>
    </table>
  </td>
</tr>`;
}

function mkButton(href, label, { from = B.p700, to = B.p900 } = {}) {
  return `
<tr>
  <td style="padding:8px 40px 28px;text-align:center;">
    <a href="${href}" target="_blank"
       style="display:inline-block;text-decoration:none;font-size:15px;font-weight:700;color:#ffffff;background:linear-gradient(135deg,${from},${to});padding:16px 44px;border-radius:12px;letter-spacing:0.2px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
      ${label}
    </a>
  </td>
</tr>`;
}

function mkSecondaryButton(href, label, color = B.p700) {
  return `
<tr>
  <td style="padding:0 40px 24px;text-align:center;">
    <a href="${href}" target="_blank"
       style="display:inline-block;text-decoration:none;font-size:14px;font-weight:600;color:${color};border:2px solid ${color};padding:12px 36px;border-radius:12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
      ${label}
    </a>
  </td>
</tr>`;
}

function mkStats(stats) {
  const cells = stats.map(s => `
<td style="text-align:center;background:${B.surface};border:1.5px solid ${B.border};border-radius:14px;padding:20px 10px;">
  <div style="font-size:30px;font-weight:800;color:${B.p700};letter-spacing:-1px;font-family:Georgia,serif;line-height:1.1;">${s.value}</div>
  <div style="font-size:11.5px;color:${B.muted};margin-top:6px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">${s.label}</div>
</td>`).join(`<td style="width:12px;"></td>`);
  return `
<tr><td style="padding:0 40px 28px;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${cells}</tr></table>
</td></tr>`;
}

function mkFeatureList(features) {
  const rows = features.map((f, i) => `
<tr>
  <td style="padding:14px 0;vertical-align:top;width:36px;">
    <div style="width:32px;height:32px;border-radius:9px;background:${f.bg || B.p100};text-align:center;line-height:32px;font-size:16px;">${f.icon}</div>
  </td>
  <td style="padding:14px 0 14px 14px;vertical-align:top;border-bottom:${i < features.length-1 ? `1px solid ${B.border}` : 'none'};">
    <div style="font-size:13.5px;font-weight:700;color:${B.text};margin-bottom:3px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">${f.title}</div>
    <div style="font-size:12.5px;color:${B.muted};line-height:1.6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">${f.desc}</div>
  </td>
</tr>`).join('');
  return `
<tr><td style="padding:0 40px 24px;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0"
         style="background:${B.surface};border:1.5px solid ${B.border};border-radius:14px;">
    <tr><td style="padding:4px 20px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>
    </td></tr>
  </table>
</td></tr>`;
}

function mkP(html, opts = {}) {
  const { mb = '20px', size = '14.5px', color = B.sub } = opts;
  return `<p style="margin:0 0 ${mb};font-size:${size};color:${color};line-height:1.8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">${html}</p>`;
}

function mkBody(html) {
  return `<tr><td style="padding:36px 40px 8px;">${html}</td></tr>`;
}

function mkSectionLabel(text) {
  return `<tr><td style="padding:8px 40px 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:${B.muted};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">${text}</td></tr>`;
}

function mkFooter() {
  return `
<tr>
  <td style="background:${B.surface};border-top:1.5px solid ${B.border};padding:32px 40px;text-align:center;">
    <table cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 16px;">
      <tr>
        <td style="width:28px;height:28px;background:linear-gradient(135deg,${B.p700},${B.p900});border-radius:7px;text-align:center;vertical-align:middle;">
          <span style="font-size:13px;font-weight:900;color:#ffffff;font-family:Georgia,serif;display:block;line-height:28px;">C</span>
        </td>
        <td style="padding-left:8px;vertical-align:middle;">
          <span style="font-size:14px;font-weight:700;color:${B.p800};font-family:Georgia,serif;">Cittaa Health Services</span>
        </td>
      </tr>
    </table>
    <p style="margin:0 0 8px;font-size:12px;color:${B.muted};line-height:1.8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
      Powered by <strong style="color:${B.p700};">VocoCore&trade;</strong> &nbsp;&middot;&nbsp;
      <a href="${PLATFORM_URL}" style="color:${B.p700};text-decoration:none;font-weight:600;">Open Platform</a>
    </p>
    <p style="margin:0;font-size:11px;color:${B.light};line-height:1.7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
      &copy; ${new Date().getFullYear()} Cittaa Health Services &middot; All rights reserved<br>
      This is an automated message &mdash; please do not reply directly.
    </p>
  </td>
</tr>`;
}

function wrapHtml(innerRows) {
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
    body{margin:0;padding:0;background:${B.bg}}
    table{border-collapse:collapse!important}
    img{border:0;height:auto;line-height:100%;outline:none;text-decoration:none}
    a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important}
    @media only screen and (max-width:600px){
      .ew{width:100%!important;border-radius:0!important}
      .ep td{padding-left:20px!important;padding-right:20px!important}
      h1{font-size:22px!important}
    }
  </style>
</head>
<body style="margin:0;padding:0;background:${B.bg};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr><td style="padding:36px 16px;">
      <table role="presentation" class="ew" align="center" cellpadding="0" cellspacing="0" border="0"
             style="max-width:600px;width:100%;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 8px 40px rgba(109,40,217,0.10),0 2px 8px rgba(0,0,0,0.06);">
        ${innerRows}
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/* ══════════════════════════════════════════════════════════════════════════
   SEND CORE
══════════════════════════════════════════════════════════════════════════ */
async function sendEmail({ to, subject, html, text, urgent = false }) {
  const resend = getResend();
  if (!resend) { logger.warn('Email skipped (no RESEND_API_KEY)', { to, subject }); return null; }
  if (!urgent && !isISTBusinessHours()) { logger.info('Queuing non-urgent email outside business hours', { to, subject }); }
  try {
    const result = await resend.emails.send({ from: `${BRAND_NAME} <${FROM_EMAIL}>`, to, subject, html, text: text || subject });
    logger.info('Email sent', { to, subject, id: result.id });
    return result;
  } catch (err) {
    logger.error('Email send failed', { to, subject, error: err.message });
    throw err;
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   1. WELCOME EMAIL
══════════════════════════════════════════════════════════════════════════ */
async function sendWelcomeEmail({ to, name, loginUrl, tempPassword, companyName }) {
  const subject = `Welcome to Cittaa — your wellness journey starts today 🌱`;
  const html = wrapHtml(`
    ${mkTopBar()}
    ${mkHero(`Welcome, ${name}!`, `${companyName} has set up your personal wellness account`, { emoji: '🌱' })}
    ${mkBody(`
      ${mkP(`Hi <strong style="color:${B.text};">${name}</strong>,`)}
      ${mkP(`We're really glad you're here. <strong>${companyName}</strong> has created your private Cittaa wellness space — a safe place to check in with yourself, track your wellbeing, and access support whenever you need it.`)}
    `)}
    ${mkSectionLabel('Your Login Details')}
    ${mkInfoCard([
      { label: 'Email',              value: to },
      { label: 'Temporary password', value: `<code style="font-family:'Courier New',Courier,monospace;font-size:15px;font-weight:700;color:${B.p700};background:${B.p100};padding:2px 8px;border-radius:6px;letter-spacing:2px;">${tempPassword}</code>` },
      { label: 'Organisation',       value: companyName },
    ])}
    ${mkCallout({ type:'warning', html:`<strong>Action required:</strong> Please sign in and change your password within <strong>24 hours</strong>. Your temporary password will expire after that.` })}
    ${mkButton(loginUrl, 'Sign in to Cittaa &rarr;')}
    ${mkDivider()}
    ${mkBody(`${mkP(`Everything on this platform is strictly confidential. Your data belongs to you and is never shared without your explicit consent.`, { size:'13px', color:B.muted, mb:'0' })}`)}
    <tr><td style="height:28px;"></td></tr>
    ${mkFooter()}
  `);
  return sendEmail({ to, subject, html, urgent: true, text: `Welcome to Cittaa!\nEmail: ${to}\nTemp Password: ${tempPassword}\nLogin: ${loginUrl}` });
}

/* ══════════════════════════════════════════════════════════════════════════
   2. TRIAL INVITATION
══════════════════════════════════════════════════════════════════════════ */
async function sendTrialInvite({ to, name, companyName, daysLeft, endDate, loginUrl }) {
  const subject = `${companyName} has gifted you a free wellbeing trial 🎁`;
  const endStr  = toISTDate(endDate);
  const features = [
    { icon: '&#127897;', bg:'#ede9fe', title: 'Voice Wellness Check-ins',    desc: 'Speak naturally for 30 sec–2 min. VocoCore™ AI analyses your voice for wellbeing signals — private, non-judgemental.' },
    { icon: '&#128202;', bg:'#dbeafe', title: 'Personal Wellness Dashboard', desc: 'Watch your emotional trends evolve and receive gentle, personalised suggestions.' },
    { icon: '&#128172;', bg:'#dcfce7', title: '1:1 Support Sessions',        desc: 'Book a private consultation with a qualified clinician or EAP counsellor.' },
    { icon: '&#128218;', bg:'#fef9c3', title: 'Self-help Resource Library',  desc: 'Guided exercises, stress management tools, and wellbeing workbooks.' },
  ];
  const html = wrapHtml(`
    ${mkTopBar()}
    ${mkHero(`A gift for you, ${name}!`, `${daysLeft}-day free trial from ${companyName}`, { emoji: '&#127873;', from: B.p600, to: B.p900 })}
    ${mkBody(`
      ${mkP(`Hi <strong style="color:${B.text};">${name}</strong>,`)}
      ${mkP(`<strong>${companyName}</strong> cares about your wellbeing and has given you <strong>${daysLeft} days of completely free access</strong> to the Cittaa platform. No payment needed, no commitment — just support, whenever you want it.`)}
    `)}
    ${mkSectionLabel("What's included")}
    ${mkFeatureList(features)}
    ${mkSectionLabel('Trial Summary')}
    ${mkInfoCard([
      { label: 'Duration',           value: `<strong style="color:${B.p700};">${daysLeft} days free</strong>` },
      { label: 'Access expires',     value: endStr },
      { label: 'Credit card needed', value: `<span style="color:${B.green};font-weight:700;">No &mdash; not required</span>` },
    ])}
    ${mkButton(loginUrl, 'Begin My Free Trial &rarr;', { from: B.p600, to: B.p900 })}
    ${mkBody(`${mkP(`Trial ends on <strong>${endStr}</strong>. Talk to your HR team about continuing afterwards. Everything you share is strictly confidential.`, { size:'12.5px', color:B.muted, mb:'0' })}`)}
    <tr><td style="height:28px;"></td></tr>
    ${mkFooter()}
  `);
  return sendEmail({ to, subject, html, urgent: true, text: `${companyName} has given you a ${daysLeft}-day free Cittaa trial!\nLogin: ${loginUrl}\nExpires: ${endStr}` });
}

/* ══════════════════════════════════════════════════════════════════════════
   3. TRIAL EXPIRY REMINDER
══════════════════════════════════════════════════════════════════════════ */
async function sendTrialExpiryReminder({ to, name, companyName, daysLeft, endDate, loginUrl }) {
  const subject  = daysLeft <= 1 ? `Your Cittaa trial ends today — last chance to check in` : `${daysLeft} days left in your Cittaa trial — ${companyName}`;
  const endStr   = toISTDate(endDate);
  const isUrgent = daysLeft <= 2;
  const hFrom    = isUrgent ? B.amber   : B.p700;
  const hTo      = isUrgent ? B.amberDk : B.p900;
  const html = wrapHtml(`
    ${mkTopBar()}
    ${mkHero(
      isUrgent ? (daysLeft <= 1 ? 'Your trial ends today' : `${daysLeft} days left`) : `${daysLeft} days of trial remaining`,
      `Make the most of your access before ${endStr}`,
      { emoji: isUrgent ? '&#9200;' : '&#128197;', from: hFrom, to: hTo }
    )}
    ${mkBody(`
      ${mkP(`Hi <strong style="color:${B.text};">${name}</strong>,`)}
      ${mkP(isUrgent
        ? `Your free trial of Cittaa <strong>ends ${daysLeft <= 1 ? 'today' : 'very soon'}</strong>. If there's a check-in or consultation you've been thinking about, now's a great time.`
        : `Just a gentle reminder — your free trial with <strong>${companyName}</strong> ends in <strong>${daysLeft} days</strong> on <strong>${endStr}</strong>.`
      )}
    `)}
    ${mkCallout({ type: isUrgent ? 'warning' : 'purple', html: isUrgent
      ? `&#128155; No pressure, but a quick wellness check-in takes less than 10 minutes and can be really insightful.`
      : `&#127807; You have <strong>${daysLeft} day${daysLeft !== 1 ? 's' : ''}</strong> left. Consider booking a consultation or doing a voice check-in — both take under 15 minutes.`
    })}
    ${mkButton(loginUrl, 'Open My Dashboard &rarr;', { from: hFrom, to: hTo })}
    ${mkBody(`${mkP(`To continue after the trial, ask your HR admin about next steps. Your wellbeing data is always yours and won't be deleted.`, { size:'12.5px', color:B.muted, mb:'0' })}`)}
    <tr><td style="height:28px;"></td></tr>
    ${mkFooter()}
  `);
  return sendEmail({ to, subject, html, urgent: true, text: `Trial ending in ${daysLeft} days — ${loginUrl}` });
}

/* ══════════════════════════════════════════════════════════════════════════
   4. ASSESSMENT INVITATION
══════════════════════════════════════════════════════════════════════════ */
async function sendAssessmentInvite({ employee, clinicianName, assessmentUrl, scheduledAt }) {
  const subject     = `A wellness check-in has been arranged for you`;
  const scheduledDate = toIST(scheduledAt);
  const html = wrapHtml(`
    ${mkTopBar()}
    ${mkHero('A wellness check-in, just for you', `Arranged by ${clinicianName}`, { emoji: '&#127897;' })}
    ${mkBody(`
      ${mkP(`Hi <strong style="color:${B.text};">${employee.firstName}</strong>,`)}
      ${mkP(`<strong>${clinicianName}</strong> has arranged a VocoCore&trade; voice wellness check-in for you. It takes just 5–10 minutes — speak naturally for a minute or two and our system gently analyses your voice for wellbeing signals. There are no right or wrong answers.`)}
    `)}
    ${mkSectionLabel('Check-in Details')}
    ${mkInfoCard([
      { label: 'Scheduled for', value: `${scheduledDate} IST` },
      { label: 'Duration',      value: '5 &ndash; 10 minutes' },
      { label: 'What happens',  value: 'Secure voice analysis (private &amp; encrypted)' },
    ])}
    ${mkCallout({ type:'info', html:`&#127897; <strong>A quiet space helps.</strong> Find somewhere comfortable, make sure your microphone is working, and speak as naturally as you would in conversation.` })}
    ${mkButton(assessmentUrl, 'Begin Check-in &rarr;')}
    ${mkBody(`${mkP(`Your results are private and shared only with your care team. If you have any concerns, reach out to ${clinicianName} directly.`, { size:'12.5px', color:B.muted, mb:'0' })}`)}
    <tr><td style="height:28px;"></td></tr>
    ${mkFooter()}
  `);
  return sendEmail({ to: employee.email, subject, html, urgent: true, text: `Wellness check-in from ${clinicianName}\nScheduled: ${scheduledDate}\nLink: ${assessmentUrl}` });
}

/* ══════════════════════════════════════════════════════════════════════════
   5. ALERT NOTIFICATION
══════════════════════════════════════════════════════════════════════════ */
async function sendAlertNotification({ to, alert, employee, tenantName }) {
  const level      = alert.alertLevel || 'high';
  const isCritical = level === 'critical';
  const subject    = isCritical
    ? `[Urgent] Wellbeing concern — ${employee.firstName} ${employee.lastName}`
    : `Wellbeing alert — ${employee.firstName} ${employee.lastName} &middot; ${tenantName}`;
  const levelCfg = {
    critical: { bg:'#fef2f2', text:'#991b1b', label:'CRITICAL', callout:'danger'  },
    high:     { bg:'#fffbeb', text:'#92400e', label:'HIGH',     callout:'warning' },
    medium:   { bg:'#fefce8', text:'#713f12', label:'MEDIUM',   callout:'warning' },
    low:      { bg:'#f0fdf4', text:'#166534', label:'LOW',      callout:'success' },
  }[level] || { bg:'#fffbeb', text:'#92400e', label:'HIGH', callout:'warning' };
  const badgeHtml = `<span style="display:inline-block;padding:3px 12px;border-radius:99px;font-size:11.5px;font-weight:700;background:${levelCfg.bg};color:${levelCfg.text};letter-spacing:0.5px;">${levelCfg.label}</span>`;
  const infoRows = [
    { label: 'Employee',     value: `${employee.firstName} ${employee.lastName}` },
    { label: 'Priority',     value: badgeHtml },
    { label: 'Organisation', value: tenantName },
  ];
  if ((alert.triggeringScores || []).length > 0) infoRows.push({ label: 'Indicators', value: alert.triggeringScores.join(' &middot; ') });
  const html = wrapHtml(`
    ${mkTopBar()}
    ${mkHero(
      isCritical ? 'Urgent Wellbeing Alert' : 'Wellbeing Alert',
      `${tenantName} — requires your careful attention`,
      { emoji: isCritical ? '&#128308;' : '&#128993;', from: isCritical ? B.red : B.amber, to: isCritical ? B.redDk : B.amberDk }
    )}
    ${mkBody(`${mkP(`This alert was generated for one of your team members. Please review and respond with care.`)}`)}
    ${mkSectionLabel('Alert Details')}
    ${mkInfoCard(infoRows)}
    ${mkCallout({ type: isCritical ? 'danger' : 'warning', html: isCritical
      ? `&#128308; <strong>Please review promptly.</strong> This indicator suggests the person may benefit from immediate, sensitive support. Approach with care and full confidentiality.`
      : `&#9888;&#65039; <strong>Recommended action:</strong> Review the assessment and consider whether a follow-up conversation or consultation would be helpful for this person.`
    })}
    ${mkButton(`${PLATFORM_URL}/alerts/${alert._id}`, 'Review Alert &rarr;', { from: isCritical ? B.red : B.amber, to: isCritical ? B.redDk : B.amberDk })}
    ${mkBody(`${mkP(`Handle this information with full sensitivity and in accordance with your organisation's safeguarding policies.`, { size:'12.5px', color:B.muted, mb:'0' })}`)}
    <tr><td style="height:28px;"></td></tr>
    ${mkFooter()}
  `);
  return sendEmail({ to, subject, html, urgent: true, text: `[${level.toUpperCase()}] Alert for ${employee.firstName} ${employee.lastName}\n${PLATFORM_URL}/alerts/${alert._id}` });
}

/* ══════════════════════════════════════════════════════════════════════════
   6. CONSULTATION INVITE
══════════════════════════════════════════════════════════════════════════ */
async function sendConsultationInvite({ to, consultation, meetLink, calendarLink }) {
  const subject = `Your wellness consultation is confirmed`;
  const when    = toIST(consultation.scheduledAt);
  const isOnline = consultation.mode === 'online';
  const html = wrapHtml(`
    ${mkTopBar()}
    ${mkHero('Your consultation is confirmed &#10024;', 'A dedicated space set aside just for you', { from: B.teal, to: B.tealDk })}
    ${mkBody(`${mkP(`Everything is set for your upcoming session. This is a private, supportive space — feel free to bring whatever's on your mind.`)}`)}
    ${mkSectionLabel('Session Details')}
    ${mkInfoCard([
      { label: 'When',     value: `${when} IST` },
      { label: 'Duration', value: `${consultation.durationMinutes || 30} minutes` },
      { label: 'Format',   value: isOnline ? 'Online &middot; Google Meet' : `In-person${consultation.location ? ` &middot; ${consultation.location}` : ''}` },
    ])}
    ${isOnline ? mkCallout({ type:'info', html:`&#128161; <strong>A few things that help:</strong> Find a quiet private space, have some water nearby, and test your connection beforehand. No need to prepare anything — just show up.` }) : ''}
    ${meetLink ? mkButton(meetLink, 'Join Meeting &rarr;', { from: B.teal, to: B.tealDk }) : ''}
    ${calendarLink ? mkSecondaryButton(calendarLink, '+ Add to Calendar', B.teal) : ''}
    ${mkBody(`${mkP(`Need to reschedule? Please let your clinician know as early as possible. We understand — life happens.`, { size:'12.5px', color:B.muted, mb:'0' })}`)}
    <tr><td style="height:28px;"></td></tr>
    ${mkFooter()}
  `);
  return sendEmail({ to, subject, html, urgent: true, text: `Consultation confirmed: ${when} IST${meetLink ? `\nJoin: ${meetLink}` : ''}` });
}

/* ══════════════════════════════════════════════════════════════════════════
   7. PASSWORD RESET
══════════════════════════════════════════════════════════════════════════ */
async function sendPasswordReset({ to, name, resetUrl, expiresIn }) {
  const subject = `Reset your Cittaa password`;
  const expiry  = typeof expiresIn === 'number' ? `${expiresIn} minutes` : (expiresIn || '30 minutes');
  const html = wrapHtml(`
    ${mkTopBar()}
    ${mkHero('Reset your password', 'Follow the link below — it only takes a moment', { emoji: '&#128274;' })}
    ${mkBody(`
      ${mkP(`Hi <strong style="color:${B.text};">${name}</strong>,`)}
      ${mkP(`We received a request to reset the password for your Cittaa account. Click the button below and you'll be set up in seconds.`)}
    `)}
    ${mkButton(resetUrl, 'Reset My Password &rarr;')}
    ${mkSectionLabel('Security Info')}
    ${mkInfoCard([{ label: 'Link expires in', value: expiry }])}
    ${mkCallout({ type:'purple', html:`&#128274; <strong>Didn't request this?</strong> No action needed — just ignore this email. Your password won't change. If you're concerned, contact your administrator.` })}
    <tr><td style="height:28px;"></td></tr>
    ${mkFooter()}
  `);
  return sendEmail({ to, subject, html, urgent: true, text: `Password reset for ${name}: ${resetUrl}\nExpires in: ${expiry}` });
}

/* ══════════════════════════════════════════════════════════════════════════
   8. WEEKLY HR REPORT
══════════════════════════════════════════════════════════════════════════ */
async function sendWeeklyHRReport({ to, hrAdmin, reportData, tenantName }) {
  const subject = `Weekly wellbeing pulse — ${tenantName}`;
  const dateStr = toISTDate(new Date());
  const levelCfg = {
    critical: { bg:'#fef2f2', text:'#991b1b' },
    high:     { bg:'#fffbeb', text:'#92400e' },
    medium:   { bg:'#fefce8', text:'#713f12' },
    low:      { bg:'#f0fdf4', text:'#166534' },
  };
  const alertRows = (reportData.recentAlerts || []).slice(0, 5).map((a) => {
    const cfg = levelCfg[a.level] || levelCfg.high;
    return `
<tr>
  <td style="padding:12px 16px 12px 0;font-size:13px;color:${B.text};font-weight:600;border-bottom:1px solid ${B.border};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">${a.employeeName}</td>
  <td style="padding:12px 8px;border-bottom:1px solid ${B.border};">
    <span style="display:inline-block;padding:3px 10px;border-radius:99px;font-size:11px;font-weight:700;background:${cfg.bg};color:${cfg.text};">${(a.level||'').toUpperCase()}</span>
  </td>
  <td style="padding:12px 0;font-size:13px;color:${B.muted};border-bottom:1px solid ${B.border};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">${a.status}</td>
</tr>`;
  }).join('');

  const html = wrapHtml(`
    ${mkTopBar()}
    ${mkHero('Weekly Wellbeing Pulse', `${tenantName} &middot; ${dateStr}`, { emoji: '&#128202;' })}
    ${mkBody(`
      ${mkP(`Hi <strong style="color:${B.text};">${hrAdmin.firstName}</strong>,`)}
      ${mkP(`Here's a summary of wellbeing activity across your organisation this week.`)}
    `)}
    ${mkStats([
      { value: reportData.totalAssessments || 0,                                                    label: 'Check-ins' },
      { value: reportData.activeAlerts     || 0,                                                    label: 'Active Alerts' },
      { value: reportData.avgWellnessScore ? Math.round(reportData.avgWellnessScore) : '&mdash;',  label: 'Avg Wellness' },
    ])}
    ${alertRows ? `
    ${mkSectionLabel('Recent Alerts')}
    <tr><td style="padding:0 40px 28px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0"
             style="background:${B.surface};border:1.5px solid ${B.border};border-radius:14px;">
        <tr><td style="padding:14px 20px;border-bottom:2px solid ${B.border};">
          <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
            <th style="text-align:left;font-size:11px;font-weight:700;color:${B.p700};text-transform:uppercase;letter-spacing:0.5px;padding-right:16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">Employee</th>
            <th style="text-align:left;font-size:11px;font-weight:700;color:${B.p700};text-transform:uppercase;letter-spacing:0.5px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">Level</th>
            <th style="text-align:left;font-size:11px;font-weight:700;color:${B.p700};text-transform:uppercase;letter-spacing:0.5px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">Status</th>
          </tr></table>
        </td></tr>
        <tr><td style="padding:0 20px;"><table width="100%" cellpadding="0" cellspacing="0" border="0">${alertRows}</table></td></tr>
      </table>
    </td></tr>` : ''}
    ${mkButton(`${PLATFORM_URL}/hr/analytics`, 'View Full Dashboard &rarr;')}
    ${mkCallout({ type:'purple', html:`&#128156; Remember — behind every data point is a person. Thank you for caring about your team.` })}
    <tr><td style="height:16px;"></td></tr>
    ${mkFooter()}
  `);
  return sendEmail({ to, subject, html, text: `Weekly report — ${tenantName}\nCheck-ins: ${reportData.totalAssessments || 0}` });
}

/* ══════════════════════════════════════════════════════════════════════════
   9. CONSULTATION REMINDER
══════════════════════════════════════════════════════════════════════════ */
async function sendConsultationReminder({ to, consultation, minutesBefore }) {
  const subject = `Your session starts in ${minutesBefore} minutes`;
  const time    = toISTTime(consultation.scheduledAt);
  const html = wrapHtml(`
    ${mkTopBar()}
    ${mkHero(`Starting in ${minutesBefore} min`, `${time} IST — your session is about to begin`, { emoji: '&#9200;', from: B.teal, to: B.tealDk })}
    ${mkBody(`${mkP(`Your wellness session is about to begin. Take a slow breath, find somewhere comfortable, and join when you're ready.`)}`)}
    ${mkCallout({ type:'info', html:`&#127807; There's no rush. Even if you're a minute or two late, that's completely fine.` })}
    ${consultation.meetLink ? mkButton(consultation.meetLink, 'Join Now &rarr;', { from: B.teal, to: B.tealDk }) : ''}
    ${consultation.location ? mkBody(`${mkP(`In-person at: <strong>${consultation.location}</strong>`, { size:'13px', color:B.muted, mb:'0' })}`) : ''}
    <tr><td style="height:28px;"></td></tr>
    ${mkFooter()}
  `);
  return sendEmail({ to, subject, html, urgent: true, text: `Session in ${minutesBefore} min${consultation.meetLink ? `\n${consultation.meetLink}` : ''}` });
}

/* ══════════════════════════════════════════════════════════════════════════
   10. ALERT ESCALATION
══════════════════════════════════════════════════════════════════════════ */
async function sendAlertEscalationNotification({ to, alert, employee, reason }) {
  const subject = `[Escalated] Wellbeing concern — ${employee.firstName} ${employee.lastName}`;
  const html = wrapHtml(`
    ${mkTopBar()}
    ${mkHero('Alert Escalated to You', 'Requires your immediate, careful attention', { emoji: '&#128308;', from: B.red, to: B.redDk })}
    ${mkCallout({ type:'danger', html:`&#128308; <strong>This alert has been escalated.</strong> Please review and respond according to your organisation's safeguarding and duty-of-care protocols.` })}
    ${mkSectionLabel('Case Details')}
    ${mkInfoCard([
      { label: 'Employee',         value: `${employee.firstName} ${employee.lastName}` },
      { label: 'Alert level',      value: `<span style="display:inline-block;padding:3px 12px;border-radius:99px;font-size:11.5px;font-weight:700;background:#fef2f2;color:#991b1b;">CRITICAL</span>` },
      { label: 'Reason escalated', value: reason },
    ])}
    ${mkButton(`${PLATFORM_URL}/alerts/${alert._id}`, 'Review Case &rarr;', { from: B.red, to: B.redDk })}
    ${mkBody(`${mkP(`Treat this information with full confidentiality. The person behind this data deserves your care and discretion.`, { size:'12.5px', color:B.muted, mb:'0' })}`)}
    <tr><td style="height:28px;"></td></tr>
    ${mkFooter()}
  `);
  return sendEmail({ to, subject, html, urgent: true, text: `ESCALATED: ${employee.firstName} ${employee.lastName}\n${PLATFORM_URL}/alerts/${alert._id}` });
}


/* ─── B2C Registration Emails ────────────────────────────────────────────── */

/**
 * sendB2CRegistrationAlert — fired when a new individual registers on mind.cittaa.in
 * Sent to Cittaa admins (ALERT_EMAIL_TO) with approve/reject action context
 */
async function sendB2CRegistrationAlert({ user, userId }) {
  const adminEmails = (process.env.ALERT_EMAIL_TO || '')
    .split(',').map(e => e.trim()).filter(Boolean);
  if (!adminEmails.length) {
    logger.warn('sendB2CRegistrationAlert: ALERT_EMAIL_TO not set — skipping');
    return;
  }

  const subject = `[Vocalysis] New individual registration — ${user.firstName} ${user.lastName}`;
  const approveUrl = `${PLATFORM_URL}/cittaa-admin/b2c-registrations`;

  const html = wrapHtml(`
    ${mkTopBar()}
    ${mkHero('New B2C Registration', 'An individual has signed up on mind.cittaa.in', { emoji: '&#128100;', from: B.p700, to: B.p900 })}
    ${mkSectionLabel('Applicant Details')}
    ${mkInfoCard([
      { label: 'Name',       value: `${user.firstName} ${user.lastName}` },
      { label: 'Email',      value: user.email },
      { label: 'Submitted',  value: toIST(new Date()) },
      { label: 'Flow',       value: 'B2C — Individual (requires approval)' },
    ])}
    ${mkCallout({ type: 'info', html: 'This registration is <strong>pending your approval</strong>. The user cannot log in until you approve their account.' })}
    ${mkButton(approveUrl, 'Review Registrations &rarr;')}
    ${mkFooter()}
  `);

  for (const to of adminEmails) {
    await sendEmail({ to, subject, html,
      text: `New B2C registration from ${user.firstName} ${user.lastName} (${user.email}). Review at ${approveUrl}`
    }).catch(err => logger.error('sendB2CRegistrationAlert failed', { to, error: err.message }));
  }
}

/**
 * sendB2CPendingNotification — sent to the user immediately after they register
 * Lets them know their account is under review
 */
async function sendB2CPendingNotification({ to, name }) {
  const subject = 'Your Vocalysis account is under review';
  const html = wrapHtml(`
    ${mkTopBar()}
    ${mkHero('Application Received!', 'We are reviewing your account', { emoji: '&#128338;', from: B.teal, to: B.tealDk })}
    ${mkBody(`
      ${mkP(`Hi ${name},`)}
      ${mkP(`Thank you for signing up for <strong>Vocalysis</strong> — AI-powered wellness insights.`)}
      ${mkP(`Your application has been received and is currently under review by our team. We typically review applications within <strong>1–2 business days</strong>.`)}
      ${mkP(`You will receive an email at this address as soon as your account is approved and ready to use.`)}
    `)}
    ${mkCallout({ type: 'info', html: 'If you have any questions in the meantime, please reach out to <a href="mailto:support@cittaa.in" style="color:${B.p700}">support@cittaa.in</a>.' })}
    ${mkFooter()}
  `);
  return sendEmail({ to, subject, html, text: `Hi ${name}, your Vocalysis account is under review. We'll email you once it's approved.` });
}

/**
 * sendB2CApprovalEmail — sent to user when Cittaa admin approves their account
 */
async function sendB2CApprovalEmail({ to, name, loginUrl }) {
  const url = loginUrl || `${PLATFORM_URL}/login`;
  const subject = '🎉 Your Vocalysis account is approved!';
  const html = wrapHtml(`
    ${mkTopBar()}
    ${mkHero('You\u2019re approved!', 'Your wellness journey starts now', { emoji: '&#127881;', from: B.green, to: B.greenDk })}
    ${mkBody(`
      ${mkP(`Hi ${name},`)}
      ${mkP(`Great news — your Vocalysis account has been <strong>approved</strong> by our team!`)}
      ${mkP(`You can now sign in and begin your personalised wellness journey using our AI-powered voice biomarker analysis.`)}
    `)}
    ${mkButton(url, 'Sign In to Vocalysis &rarr;', { from: B.green, to: B.greenDk })}
    ${mkCallout({ type: 'success', html: '&#127381; <strong>Your first wellness check-in is waiting.</strong> It takes just 5 minutes and is completely confidential.' })}
    ${mkFooter()}
  `);
  return sendEmail({ to, subject, html, text: `Hi ${name}, your Vocalysis account is approved! Sign in at ${url}` });
}

/**
 * sendB2CRejectionEmail — sent to user when Cittaa admin rejects their account
 */
async function sendB2CRejectionEmail({ to, name, reason }) {
  const subject = 'Regarding your Vocalysis registration';
  const html = wrapHtml(`
    ${mkTopBar()}
    ${mkHero('Registration Update', 'Regarding your account application', { emoji: '&#128203;', from: B.amber, to: B.amberDk })}
    ${mkBody(`
      ${mkP(`Hi ${name},`)}
      ${mkP(`Thank you for your interest in Vocalysis.`)}
      ${mkP(`After reviewing your registration, we are unable to approve your account at this time.`)}
      ${reason ? mkCallout({ type: 'warning', html: `<strong>Reason:</strong> ${reason}` }) : ''}
      ${mkP(`If you believe this is a mistake or would like to discuss further, please contact us at <a href="mailto:support@cittaa.in" style="color:${B.p700}">support@cittaa.in</a> and we will be happy to help.`)}
    `)}
    ${mkFooter()}
  `);
  return sendEmail({ to, subject, html, text: `Hi ${name}, we were unable to approve your Vocalysis registration. ${reason ? 'Reason: ' + reason : ''} Contact support@cittaa.in for help.` });
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
  sendMemberActivityNotification,
  // B2C individual registration
  sendB2CRegistrationAlert,
  sendB2CPendingNotification,
  sendB2CApprovalEmail,
  sendB2CRejectionEmail,
};

/* ─── Cittaa Admin: member activity notification ─────────────────────────── */
/**
 * sendMemberActivityNotification
 * Fired every time an employee completes an assessment.
 * Recipients: ALERT_EMAIL_TO env var (comma-separated, e.g. sairam@cittaa.in,rohan@cittaa.in)
 */
async function sendMemberActivityNotification({ session, tenantName }) {
  const adminEmails = (process.env.ALERT_EMAIL_TO || '')
    .split(',')
    .map(e => e.trim())
    .filter(Boolean);

  if (!adminEmails.length) {
    logger.warn('sendMemberActivityNotification: ALERT_EMAIL_TO not set — skipping admin email');
    return;
  }

  const score     = session.vocacoreResults?.wellnessScore ?? session.employeeWellnessOutput?.wellnessScore ?? null;
  const riskLevel = session.vocacoreResults?.riskLevel ?? 'unknown';
  const subject   = `[Vocalysis] Member assessment completed — ${tenantName || session.tenantId}`;

  const html = wrapHtml(`
    ${mkTopBar()}
    ${mkHero('Member Activity', 'An employee just completed a wellness assessment', { emoji: '&#9989;', from: B.teal, to: B.tealDk })}
    ${mkSectionLabel('Assessment Details')}
    ${mkInfoCard([
      { label: 'Organisation',   value: tenantName || session.tenantId },
      { label: 'Session ID',     value: session._id || session.sessionId },
      { label: 'Wellness Score', value: score !== null ? `${score} / 100` : '—' },
      { label: 'Risk Level',     value: riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1) },
      { label: 'Completed (IST)',value: toIST(new Date()) },
    ])}
    ${mkButton(`${PLATFORM_URL}/cittaa-admin`, 'View Admin Dashboard &rarr;', { from: B.teal, to: B.tealDk })}
    ${mkFooter()}
  `);

  for (const to of adminEmails) {
    await sendEmail({ to, subject, html, text: `Member assessment completed for ${tenantName || session.tenantId}. Session: ${session._id}. Score: ${score}. Risk: ${riskLevel}.` })
      .catch(err => logger.error('sendMemberActivityNotification failed', { to, error: err.message }));
  }
}
