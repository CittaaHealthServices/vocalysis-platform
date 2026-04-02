/**
 * Audio routes — ElevenLabs TTS for Voca Voice™ wellness feedback
 * Mounted at /audio
 *
 * Keeps the ElevenLabs API key safely on the server side.
 */
const express = require('express');
const https   = require('https');
const router  = express.Router();
const { requireAuth } = require('../middleware/auth');
const logger  = require('../utils/logger');

const ELEVEN_API_KEY     = process.env.ELEVENLABS_API_KEY;
const DEFAULT_VOICE_ID   = process.env.ELEVENLABS_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL'; // "Bella" — warm female

/**
 * Build a personalized wellness message for the employee.
 */
function buildWellnessScript({ firstName, wellnessScore, riskLevel, mood, streakDays }) {
  const name   = firstName || 'friend';
  const score  = wellnessScore ?? null;
  const risk   = (riskLevel || 'LOW').toUpperCase();

  let opening, body, closing;

  // Opening
  const greetings = [
    `Hey ${name}! It's Voca here, your wellness companion.`,
    `Hello ${name}! Voca here with a little something just for you.`,
    `Hi ${name}! I'm Voca, and I've been thinking about you.`,
  ];
  opening = greetings[Math.floor(Math.random() * greetings.length)];

  // Body based on score / risk
  if (score === null) {
    body = `You haven't completed a wellness check-in yet. No worries at all — whenever you're ready, I'll be right here. ` +
           `Your mental wellbeing matters, and even a few minutes of reflection can make a real difference. ` +
           `Take a breath, and check in whenever feels right.`;
  } else if (risk === 'CRITICAL' || score < 40) {
    body = `I can see you've been going through a really tough time lately, and I want you to know — that's completely okay. ` +
           `Your wellness score today is ${score} out of 100. ` +
           `Please know that you are not alone. Speaking to one of our psychologists could bring real relief. ` +
           `You deserve care and support, and reaching out is a sign of incredible strength.`;
  } else if (risk === 'HIGH' || score < 55) {
    body = `You're carrying some weight right now, and I see that. Your wellness score today is ${score} out of 100. ` +
           `Things might feel a bit heavy, but you've checked in — and that itself takes courage. ` +
           `Consider connecting with your psychologist this week. Small steps, one at a time.`;
  } else if (risk === 'MODERATE' || score < 70) {
    body = `You're doing pretty well overall! Your wellness score today is ${score} out of 100. ` +
           `There are a few areas where a little extra care could go a long way. ` +
           `Whether it's sleep, stress, or just taking a breather — you've got this. ` +
           `Keep listening to yourself.`;
  } else {
    body = `Wonderful news — you're doing great! Your wellness score today is an impressive ${score} out of 100. ` +
           `Whatever you're doing — keep it up! Your consistency and self-awareness are truly paying off. ` +
           `You are a shining example of what it means to prioritize your wellbeing.`;
  }

  // Streak bonus
  if (streakDays && streakDays >= 3) {
    body += ` And a special mention — you've checked in ${streakDays} days in a row. That's an amazing streak, ${name}!`;
  }

  // Closing
  closing = `Remember, every day you show up for yourself is a win. Take care, ${name}. I'll be here whenever you need me. 💜`;

  return `${opening} ${body} ${closing}`;
}

/**
 * POST /audio/wellness-voice
 * Generate and stream a personalized ElevenLabs TTS message.
 *
 * Body: { firstName, wellnessScore, riskLevel, mood, streakDays }
 */
router.post('/wellness-voice', requireAuth, async (req, res) => {
  if (!ELEVEN_API_KEY) {
    logger.warn('ElevenLabs API key not configured — returning 503');
    return res.status(503).json({
      error: 'Voice service not configured',
      message: 'Set ELEVENLABS_API_KEY in environment variables',
    });
  }

  const { firstName, wellnessScore, riskLevel, mood, streakDays } = req.body;
  const voiceId = req.body.voiceId || DEFAULT_VOICE_ID;

  try {
    const script = buildWellnessScript({ firstName, wellnessScore, riskLevel, mood, streakDays });
    logger.info('Generating ElevenLabs wellness voice', {
      userId: req.user.userId,
      voiceId,
      scriptLength: script.length,
    });

    // Call ElevenLabs streaming API
    const elevenPayload = JSON.stringify({
      text: script,
      model_id: 'eleven_turbo_v2',
      voice_settings: {
        stability: 0.55,
        similarity_boost: 0.75,
        style: 0.2,
        use_speaker_boost: true,
      },
    });

    const audioChunks = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.elevenlabs.io',
        path:     `/v1/text-to-speech/${voiceId}`,
        method:   'POST',
        headers:  {
          'Content-Type':  'application/json',
          'xi-api-key':    ELEVEN_API_KEY,
          'Accept':        'audio/mpeg',
          'Content-Length': Buffer.byteLength(elevenPayload),
        },
      };

      const chunks = [];
      const req11 = https.request(options, (r) => {
        if (r.statusCode < 200 || r.statusCode >= 300) {
          let errBody = '';
          r.on('data', d => { errBody += d; });
          r.on('end', () => reject(new Error(`ElevenLabs ${r.statusCode}: ${errBody}`)));
          return;
        }
        r.on('data', chunk => chunks.push(chunk));
        r.on('end', () => resolve(Buffer.concat(chunks)));
      });

      req11.on('error', reject);
      req11.write(elevenPayload);
      req11.end();
    });

    logger.info('ElevenLabs audio generated', {
      userId: req.user.userId,
      bytes: audioChunks.length,
    });

    // Return the script text alongside the audio (base64-encoded)
    // The frontend can decode and play it without CORS complexity
    res.json({
      success: true,
      data: {
        script,
        audioBase64: audioChunks.toString('base64'),
        mimeType: 'audio/mpeg',
      },
    });
  } catch (err) {
    logger.error('ElevenLabs TTS failed', { error: err.message });
    res.status(500).json({ error: 'Voice generation failed', details: err.message });
  }
});

/**
 * GET /audio/voices
 * List available ElevenLabs voices (for admins to configure preferred voice)
 */
router.get('/voices', requireAuth, async (req, res) => {
  if (!ELEVEN_API_KEY) {
    return res.json({ success: true, data: { voices: [] } });
  }

  try {
    const voices = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.elevenlabs.io',
        path:     '/v1/voices',
        method:   'GET',
        headers:  { 'xi-api-key': ELEVEN_API_KEY },
      };

      let body = '';
      const req11 = https.request(options, (r) => {
        r.on('data', d => { body += d; });
        r.on('end', () => {
          try { resolve(JSON.parse(body)); }
          catch (e) { reject(e); }
        });
      });
      req11.on('error', reject);
      req11.end();
    });

    res.json({ success: true, data: { voices: voices.voices || [] } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch voices' });
  }
});

module.exports = router;
