/**
 * OutcomeFollowUp — closed-loop intervention measurement
 *
 * Created automatically 3 days after any high-risk session (orange/red).
 * The employee receives a WhatsApp/email ping asking how they feel.
 * Their response is stored here and correlated against the original session.
 *
 * Also used to track consultation outcomes (psychologist fills post-session form).
 */

const mongoose = require('mongoose');

const outcomeFollowUpSchema = new mongoose.Schema({
  tenantId:    { type: String, required: true, index: true },
  employeeId:  { type: String, required: true, index: true },
  sessionId:   { type: String, required: true, index: true }, // original session

  type: {
    type: String,
    enum: ['checkin_followup', 'consultation_outcome', 'intervention_check'],
    default: 'checkin_followup',
  },

  // Scheduled delivery
  scheduledFor:  { type: Date, required: true },
  sentAt:        Date,
  channel:       { type: String, enum: ['whatsapp', 'email', 'in_app'], default: 'whatsapp' },

  // Employee self-report (3-day follow-up)
  selfReport: {
    response:    { type: String, enum: ['better', 'same', 'harder', null], default: null },
    moodScore:   { type: Number, min: 1, max: 5 },   // 1 = very bad, 5 = very good
    respondedAt: Date,
    notes:       String,
  },

  // Context from the original triggering session
  triggerContext: {
    riskLevel:     String,  // 'orange' | 'red'
    wellnessScore: Number,
    dominantDimension: String,  // 'depression' | 'anxiety' | 'stress'
  },

  // Score at follow-up time (filled by cron after response arrives)
  followUpScore: {
    wellnessScore: Number,
    riskLevel:     String,
    measuredAt:    Date,
  },

  // Intervention that was recommended (for correlation)
  recommendedIntervention: {
    type:        String,  // 'counselling', 'peer_buddy', 'workload_reduction', etc.
    description: String,
    acceptedBy:  { type: Boolean, default: null },  // did employee act on it?
  },

  // Consultation outcome (filled by psychologist post-session)
  consultationOutcome: {
    sessionType:          String,
    goalsAchieved:        { type: Number, min: 1, max: 5 },
    patientEngagement:    { type: Number, min: 1, max: 5 },
    progressNotes:        String,
    recommendedFollowUp:  Boolean,
    clinicianId:          String,
    submittedAt:          Date,
  },

  status: {
    type: String,
    enum: ['pending', 'sent', 'responded', 'expired', 'cancelled'],
    default: 'pending',
  },

  expiresAt: Date,  // If no response by this date → mark expired
}, { timestamps: true });

outcomeFollowUpSchema.index({ tenantId: 1, scheduledFor: 1 });
outcomeFollowUpSchema.index({ tenantId: 1, employeeId: 1, createdAt: -1 });
outcomeFollowUpSchema.index({ sessionId: 1 });

module.exports = mongoose.model('OutcomeFollowUp', outcomeFollowUpSchema);
