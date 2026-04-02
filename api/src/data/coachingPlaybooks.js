/**
 * Manager Coaching Playbooks
 * ──────────────────────────
 * Static content library for manager coaching module.
 * Indexed by risk pattern (dominant dimension + severity).
 *
 * All content is:
 *  - Non-clinical (managers are not therapists)
 *  - Actionable within a manager's authority
 *  - Culturally sensitive for Indian workplace context
 *  - Anonymous-safe (does not reference individual employee data)
 */

const playbooks = {

  // ── STRESS (most common in Indian workplaces) ───────────────────────────────

  stress_high: {
    title: 'High Stress Detected in Your Team',
    summary: 'One or more team members are showing signs of acute workplace stress. This often stems from workload, deadlines, or interpersonal pressure.',
    urgency: 'high',
    conversationStarters: [
      "\"I've noticed you seem stretched thin lately — I just want to check in. How are things going on your end?\"",
      "\"Is there anything making work feel particularly heavy right now? No pressure to share everything, just want you to know I'm available.\"",
      "\"If you could change one thing about your current workload or work setup, what would it be?\"",
      "\"I want to make sure you have what you need to do good work without burning out. What would help most right now?\"",
      "\"We all go through intense phases. Is there anything I can take off your plate or push back a deadline on?\"",
    ],
    actions: [
      {
        id: 'workload_audit',
        title: 'Workload Audit',
        description: 'Review the employee\'s current task list together. Identify what can be dropped, delegated, or deferred by 2 weeks. Even small reductions in low-priority tasks signal genuine support.',
        effort: 'low',
        impact: 'high',
        timeframe: 'This week',
      },
      {
        id: 'deadline_flexibility',
        title: 'Deadline Flexibility',
        description: 'Where possible, extend upcoming deadlines by 3–5 days without making it feel like a demotion. Frame it as "giving the work the time it deserves."',
        effort: 'low',
        impact: 'medium',
        timeframe: 'Immediate',
      },
      {
        id: 'peer_buddy',
        title: 'Assign a Peer Buddy',
        description: 'Pair the employee with a calm, experienced colleague for informal support. Not to monitor — to provide a safe sounding board within the team.',
        effort: 'low',
        impact: 'medium',
        timeframe: 'This week',
      },
      {
        id: 'flexible_hours',
        title: 'Flexible Start/End Times',
        description: 'Offer 1–2 weeks of flexible working hours. Even shifting start time by 30 minutes can reduce commute stress significantly in Indian cities.',
        effort: 'low',
        impact: 'medium',
        timeframe: 'Immediately',
      },
      {
        id: 'eap_referral',
        title: 'Suggest EAP Counselling',
        description: 'Mention the company\'s confidential counselling benefit casually — not as a directive. "A few people on the team have found the counselling sessions really helpful, just so you know it\'s there."',
        effort: 'low',
        impact: 'high',
        timeframe: 'In your next 1:1',
      },
    ],
    doNot: [
      'Do not say "everyone is stressed" — it invalidates their experience',
      'Do not suggest yoga or meditation unless the employee brings it up first',
      'Do not increase monitoring or micromanagement — it worsens stress',
      'Do not discuss this with other team members',
    ],
    escalateIf: 'Employee shows physical symptoms (headaches, sleep issues they mention), or stress persists for more than 2 weeks despite adjustments.',
  },

  stress_moderate: {
    title: 'Moderate Stress Signal — Preventive Check-In Recommended',
    summary: 'Early stress signals detected. A brief supportive check-in now can prevent escalation.',
    urgency: 'medium',
    conversationStarters: [
      "\"Just a quick check-in — how's the week been treating you?\"",
      "\"Anything coming up that you'd like to think through together?\"",
      "\"I want to make sure the team has enough breathing room. Is the pace feeling manageable?\"",
    ],
    actions: [
      {
        id: 'scheduled_checkin',
        title: 'Schedule a Casual 1:1',
        description: 'Book a 15-minute informal conversation — coffee chat, not performance review. Make it clear it\'s supportive, not evaluative.',
        effort: 'low',
        impact: 'medium',
        timeframe: 'This week',
      },
      {
        id: 'recognition',
        title: 'Recognise Recent Contributions',
        description: 'Publicly or privately acknowledge a specific thing the employee did well recently. Recognition is one of the highest-impact, lowest-effort stress reducers.',
        effort: 'very_low',
        impact: 'medium',
        timeframe: 'Today',
      },
    ],
    doNot: [
      'Do not overreact — moderate signals often resolve with basic support',
      'Do not document this as a performance concern',
    ],
    escalateIf: 'Score moves to high or remains elevated for 2+ weeks.',
  },

  // ── DEPRESSION (most clinically sensitive) ──────────────────────────────────

  depression_high: {
    title: 'Low Mood / Withdrawal Signals — Empathetic Outreach Required',
    summary: 'Voice patterns suggest the employee may be experiencing low mood, reduced energy, or emotional withdrawal. This requires a warm, patient approach — not urgency or pressure.',
    urgency: 'high',
    conversationStarters: [
      "\"I've noticed you seem quieter lately and I just want you to know that's okay. I'm here if you ever want to talk — about work or anything else.\"",
      "\"You don't have to be 'on' all the time here. How are you actually doing?\"",
      "\"Sometimes work can feel overwhelming or pointless for a while — that's very human. Is anything like that happening for you?\"",
      "\"I want to make sure you know that your wellbeing matters more to me than any deadline. Are you getting enough rest?\"",
    ],
    actions: [
      {
        id: 'reduce_isolation',
        title: 'Reduce Workplace Isolation',
        description: 'Low mood often involves withdrawal. Create low-pressure social moments — a team lunch, a short walk, a casual chat. Don\'t force participation, but make the invitation warm and genuine.',
        effort: 'low',
        impact: 'high',
        timeframe: 'This week',
      },
      {
        id: 'eap_counselling_warm',
        title: 'Warm EAP Introduction',
        description: 'For depression signals, a direct and caring mention of counselling is appropriate: "We have a confidential counsellor through the company — completely free, no records shared with HR. I\'d really encourage you to try one session."',
        effort: 'low',
        impact: 'very_high',
        timeframe: 'In next 1:1',
      },
      {
        id: 'reduce_performance_pressure',
        title: 'Remove Performance Pressure Temporarily',
        description: 'Put any non-urgent performance conversations, targets, or reviews on hold for 2–4 weeks. Focus entirely on presence and stability, not output.',
        effort: 'low',
        impact: 'high',
        timeframe: 'Immediately',
      },
      {
        id: 'meaningful_work',
        title: 'Assign Meaningful, Manageable Tasks',
        description: 'Give the employee 1–2 tasks that are clearly achievable within a day and that have visible impact. Small wins restore motivation and self-efficacy.',
        effort: 'low',
        impact: 'medium',
        timeframe: 'This week',
      },
    ],
    doNot: [
      'Do not say "cheer up" or "think positive" — this is dismissive',
      'Do not bring up performance issues during this period',
      'Do not tell other colleagues',
      'Do not pressure the employee to explain what\'s wrong',
      'Do not interpret quietness or absence as laziness',
    ],
    escalateIf: 'Employee misses multiple days, expresses hopelessness directly, or shows signs of inability to function. Escalate to HR and company EAP counsellor immediately.',
  },

  depression_moderate: {
    title: 'Low Energy / Disengagement — Gentle Support Recommended',
    summary: 'Mild withdrawal or reduced engagement detected. A warm, no-pressure check-in is the right first step.',
    urgency: 'medium',
    conversationStarters: [
      "\"How are things going outside of work — anything draining your energy lately?\"",
      "\"I just want to check in — is work feeling okay for you right now?\"",
    ],
    actions: [
      {
        id: 'connection',
        title: 'One Genuine Connection Moment',
        description: 'Find one moment this week to connect with the employee as a human, not just as a team member. Ask about something they care about outside of work.',
        effort: 'very_low',
        impact: 'medium',
        timeframe: 'This week',
      },
    ],
    doNot: [
      'Do not diagnose or label what you\'re seeing',
      'Do not escalate prematurely — moderate signals often resolve',
    ],
    escalateIf: 'Signals persist for 3+ weeks or intensify.',
  },

  // ── ANXIETY ─────────────────────────────────────────────────────────────────

  anxiety_high: {
    title: 'Anxiety / Pressure Signals — Stabilising Environment Needed',
    summary: 'Voice patterns suggest the employee may be experiencing heightened anxiety — possibly around deadlines, performance, job security, or personal pressure.',
    urgency: 'high',
    conversationStarters: [
      "\"I want to be clear — your position here is secure and you're doing good work. Is there anything you're worried about that I can help clarify?\"",
      "\"Sometimes the pressure here can get intense. If you're feeling overwhelmed, I'd rather know early so we can figure it out together.\"",
      "\"Is there anything that feels uncertain or unclear right now that I can give you more clarity on?\"",
      "\"I've noticed you seem tense — that's completely okay. What would make things feel more manageable this week?\"",
    ],
    actions: [
      {
        id: 'clarity_and_certainty',
        title: 'Provide Clarity and Certainty',
        description: 'Anxiety thrives on ambiguity. Be explicit and reassuring about role expectations, job security, upcoming reviews, and team changes. Even neutral information ("nothing is changing") dramatically reduces anxiety.',
        effort: 'very_low',
        impact: 'very_high',
        timeframe: 'Today',
      },
      {
        id: 'reduce_uncertainty',
        title: 'Remove Ambiguous Signals',
        description: 'Review any recent communications from you or leadership that may have been ambiguous or created worry. Send a clear, positive clarification.',
        effort: 'low',
        impact: 'high',
        timeframe: 'Today or tomorrow',
      },
      {
        id: 'predictable_schedule',
        title: 'Create a Predictable Week',
        description: 'Share the employee\'s key priorities for the week in writing, with clear scope. Knowing exactly what success looks like significantly reduces anxiety.',
        effort: 'low',
        impact: 'high',
        timeframe: 'Monday morning',
      },
      {
        id: 'eap_referral',
        title: 'EAP Counselling Suggestion',
        description: 'Mention the company counsellor gently — "They\'re really good at helping with the mental pressure that comes with work. No obligation, but it\'s there."',
        effort: 'very_low',
        impact: 'high',
        timeframe: 'In next 1:1',
      },
    ],
    doNot: [
      'Do not add more tasks, even with good intentions',
      'Do not give vague reassurances like "it\'ll be fine" — be specific',
      'Do not hold surprise meetings or change plans without notice',
      'Do not say "don\'t worry about it"',
    ],
    escalateIf: 'Employee shows physical symptoms (trembling, panic attacks described), or anxiety prevents them from completing basic work for 5+ days.',
  },

  // ── DEFAULT fallback ─────────────────────────────────────────────────────────

  default: {
    title: 'Wellness Check-In Recommended',
    summary: 'A team member\'s wellness signals warrant a brief, supportive manager check-in.',
    urgency: 'low',
    conversationStarters: [
      "\"Just checking in — how are you finding things lately?\"",
      "\"Anything I can do to make your work life a bit smoother this week?\"",
    ],
    actions: [
      {
        id: 'scheduled_checkin',
        title: '15-Minute Informal Check-In',
        description: 'Book a casual, non-evaluative conversation this week.',
        effort: 'very_low',
        impact: 'medium',
        timeframe: 'This week',
      },
    ],
    doNot: ['Do not make this feel like a performance review'],
    escalateIf: 'Employee seems significantly distressed or unable to function normally.',
  },
};

/**
 * Get the right playbook for a given risk pattern.
 * @param {string} dominantDimension - 'depression' | 'anxiety' | 'stress' | 'burnout'
 * @param {string} riskLevel         - 'red' | 'orange' | 'yellow'
 */
function getPlaybook(dominantDimension, riskLevel) {
  const severity = (riskLevel === 'red') ? 'high' : 'moderate';
  const key      = `${dominantDimension}_${severity}`;
  return playbooks[key] || playbooks.default;
}

/**
 * Derive dominant dimension from dimensional scores object.
 * { depression, anxiety, stress, burnout, engagement }
 */
function getDominantDimension(dimensionalScores = {}) {
  const { depression = 0, anxiety = 0, stress = 0, burnout = 0 } = dimensionalScores;
  const scores = { depression, anxiety, stress, burnout };
  return Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
}

module.exports = { playbooks, getPlaybook, getDominantDimension };
