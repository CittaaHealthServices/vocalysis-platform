/**
 * WhatsApp Notification Service
 * ─────────────────────────────
 * Provider-agnostic abstraction layer. Currently in PLACEHOLDER mode —
 * all messages are logged to console with full structured payload.
 *
 * TO ACTIVATE TWILIO:
 *   1. Set env vars: WHATSAPP_PROVIDER=twilio
 *                    TWILIO_ACCOUNT_SID=ACxxx
 *                    TWILIO_AUTH_TOKEN=xxx
 *                    TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
 *   2. Approve message templates in Twilio sandbox / production
 *
 * TO ACTIVATE GUPSHUP:
 *   1. Set env vars: WHATSAPP_PROVIDER=gupshup
 *                    GUPSHUP_API_KEY=xxx
 *                    GUPSHUP_APP_NAME=xxx
 *                    GUPSHUP_SRC_NUMBER=+91xxxxxxxxxx
 *
 * Employee phone numbers are stored in User.phone (E.164 format, e.g. +919876543210).
 * All messages are non-blocking — failures are logged but never throw.
 */

const logger = require('../utils/logger');

const PROVIDER  = process.env.WHATSAPP_PROVIDER || 'placeholder';
const BRAND     = process.env.BRAND_NAME || 'Cittaa';

// ── Provider implementations ──────────────────────────────────────────────────

async function _sendViaTwilio(to, body) {
  const twilio = require('twilio');
  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  const from   = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886';
  const msg = await client.messages.create({ from, to: `whatsapp:${to}`, body });
  return { sid: msg.sid, status: msg.status };
}

async function _sendViaGupshup(to, body) {
  const axios = require('axios');
  const resp  = await axios.post('https://api.gupshup.io/sm/api/v1/msg', null, {
    params: {
      channel:  'whatsapp',
      source:   process.env.GUPSHUP_SRC_NUMBER,
      destination: to.replace('+', ''),
      message:  JSON.stringify({ type: 'text', text: body }),
      'src.name': process.env.GUPSHUP_APP_NAME,
    },
    headers: { apikey: process.env.GUPSHUP_API_KEY },
  });
  return { status: resp.data?.status };
}

async function _sendPlaceholder(to, body, templateName) {
  logger.info('[WhatsApp PLACEHOLDER] Would send message', {
    provider:     'placeholder',
    to,
    template:     templateName,
    bodyPreview:  body.substring(0, 120) + (body.length > 120 ? '...' : ''),
    timestamp:    new Date().toISOString(),
  });
  return { status: 'placeholder_logged' };
}

// ── Core send function ────────────────────────────────────────────────────────

async function sendWhatsApp(to, body, templateName = 'custom') {
  if (!to) {
    logger.warn('[WhatsApp] No phone number provided — skipping', { template: templateName });
    return null;
  }

  // Normalise to E.164 — add +91 if bare 10-digit Indian number
  const phone = to.startsWith('+') ? to : to.length === 10 ? `+91${to}` : `+${to}`;

  try {
    let result;
    if (PROVIDER === 'twilio') {
      result = await _sendViaTwilio(phone, body);
    } else if (PROVIDER === 'gupshup') {
      result = await _sendViaGupshup(phone, body);
    } else {
      result = await _sendPlaceholder(phone, body, templateName);
    }
    logger.info('[WhatsApp] Sent', { to: phone, template: templateName, result });
    return result;
  } catch (err) {
    logger.error('[WhatsApp] Failed (non-fatal)', { to: phone, template: templateName, error: err.message });
    return null;  // never throw — WhatsApp is non-blocking
  }
}

// ── Message templates ─────────────────────────────────────────────────────────
// Plain text — all templates approved for Indian WhatsApp Business API.
// Keep under 1024 chars. Use simple language, no jargon.

const templates = {

  /**
   * Sent to employee after each daily check-in reminder (morning nudge).
   */
  checkInReminder: ({ name }) =>
    `Hi ${name} 👋\n\nTime for your daily wellness check-in on ${BRAND}.\n\nJust 2–3 minutes of speaking naturally — our AI will handle the rest.\n\n🔗 Open app to check in\n\n_Reply STOP to opt out of reminders._`,

  /**
   * Sent after high-risk result — supportive, not alarming.
   */
  highRiskSupport: ({ name, level }) => {
    const isRed = level === 'red';
    return `Hi ${name},\n\nYour recent ${BRAND} wellness check-in showed some signs of ${isRed ? 'significant' : 'moderate'} stress.\n\nThis is completely normal — many people go through difficult phases. Your wellbeing matters to us.\n\n💬 A counsellor from your company's EAP is available to talk. Consultations are confidential.\n\n_You can book a session directly from the ${BRAND} app._`;
  },

  /**
   * Sent to employee 3 days after a high-risk session (outcome follow-up).
   */
  followUpPing: ({ name, sessionId }) =>
    `Hi ${name} 👋\n\nA few days ago you shared that you were going through a tough time.\n\nHow are you feeling today?\n\nTap one:\n✅ *Better* — things have improved\n➡️ *Same* — about the same\n😔 *Harder* — still struggling\n\nReply with Better, Same, or Harder.\n\n_Your response is private and confidential._`,

  /**
   * Sent when an employee books a consultation.
   */
  consultationBooked: ({ name, date, time, counsellorName, meetLink }) =>
    `Hi ${name} ✅\n\nYour counselling session has been confirmed!\n\n📅 *${date}* at *${time} IST*\n👤 With: ${counsellorName}\n${meetLink ? `\n🔗 Join: ${meetLink}` : ''}\n\n_You'll receive a reminder 30 minutes before the session._`,

  /**
   * Sent 30 minutes before a consultation.
   */
  consultationReminder: ({ name, minutesBefore, meetLink }) =>
    `Hi ${name} ⏰\n\nYour counselling session starts in *${minutesBefore} minutes*.\n${meetLink ? `\n🔗 Join here: ${meetLink}` : '\nPlease open the app to join.'}\n\n_Find a quiet, private spot if possible._`,

  /**
   * Sent to manager when a direct report scores high risk (anonymised).
   */
  managerAlert: ({ managerName, teamCount, riskCount }) =>
    `Hi ${managerName},\n\n📊 *${BRAND} Team Wellness Update*\n\n${riskCount} of your ${teamCount} team members showed elevated stress or risk signals this week.\n\nWe recommend checking in with your team — not to pry, but to make them feel supported.\n\n💡 Open the ${BRAND} Manager Dashboard for coaching tips and conversation starters.\n\n_Individual names are not shared to protect privacy._`,

  /**
   * Welcome message sent when a new employee is onboarded.
   */
  welcome: ({ name, loginUrl }) =>
    `Welcome to ${BRAND}, ${name}! 🎉\n\nYour company has set up voice-based wellness check-ins to support your mental health.\n\nIt takes just 2–3 minutes. Your voice is analyzed by AI — everything is private and confidential.\n\n🔗 Get started: ${loginUrl}\n\n_Need help? Reply HELP_`,

  /**
   * Sent to HR when a critical alert fires (in addition to email).
   */
  hrCriticalAlert: ({ hrName, alertCount, dashboardUrl }) =>
    `⚠️ *${BRAND} Critical Alert — Action Required*\n\nHi ${hrName},\n\n${alertCount} employee(s) have been flagged as high risk today.\n\nImmediate follow-up is recommended.\n\n📊 View details: ${dashboardUrl}\n\n_This is a confidential health alert. Please do not forward._`,
};

// ── Named send functions (called from routes/worker) ─────────────────────────

async function sendCheckInReminder({ phone, name }) {
  return sendWhatsApp(phone, templates.checkInReminder({ name }), 'checkInReminder');
}

async function sendHighRiskSupport({ phone, name, riskLevel }) {
  return sendWhatsApp(phone, templates.highRiskSupport({ name, level: riskLevel }), 'highRiskSupport');
}

async function sendFollowUpPing({ phone, name, sessionId }) {
  return sendWhatsApp(phone, templates.followUpPing({ name, sessionId }), 'followUpPing');
}

async function sendConsultationBooked({ phone, name, date, time, counsellorName, meetLink }) {
  return sendWhatsApp(phone, templates.consultationBooked({ name, date, time, counsellorName, meetLink }), 'consultationBooked');
}

async function sendConsultationReminder({ phone, name, minutesBefore, meetLink }) {
  return sendWhatsApp(phone, templates.consultationReminder({ name, minutesBefore, meetLink }), 'consultationReminder');
}

async function sendManagerAlert({ phone, managerName, teamCount, riskCount }) {
  return sendWhatsApp(phone, templates.managerAlert({ managerName, teamCount, riskCount }), 'managerAlert');
}

async function sendWelcome({ phone, name, loginUrl }) {
  return sendWhatsApp(phone, templates.welcome({ name, loginUrl: loginUrl || process.env.PLATFORM_URL }), 'welcome');
}

async function sendHRCriticalAlert({ phone, hrName, alertCount }) {
  const dashboardUrl = `${process.env.PLATFORM_URL || 'https://app.cittaa.in'}/hr/alerts`;
  return sendWhatsApp(phone, templates.hrCriticalAlert({ hrName, alertCount, dashboardUrl }), 'hrCriticalAlert');
}

module.exports = {
  sendWhatsApp,
  sendCheckInReminder,
  sendHighRiskSupport,
  sendFollowUpPing,
  sendConsultationBooked,
  sendConsultationReminder,
  sendManagerAlert,
  sendWelcome,
  sendHRCriticalAlert,
  templates,
};
