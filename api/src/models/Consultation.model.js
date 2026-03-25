const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const consultationSchema = new mongoose.Schema(
  {
    consultationId: {
      type: String,
      default: () => uuidv4(),
      unique: true,
      index: true,
    },
    tenantId: {
      type: String,
      required: true,
      index: true,
    },
    sessionId: {
      type: String,
      index: true,
      default: null,
    },
    employeeId: {
      type: String,
      required: true,
      index: true,
    },
    patientId: String,
    clinicianId: {
      type: String,
      required: true,
      index: true,
    },
    scheduledBy: {
      type: String,
      required: true,
    },
    consultationType: {
      type: String,
      enum: ['pre_assessment', 'post_assessment', 'follow_up', 'crisis', 'routine'],
      required: true,
    },
    mode: {
      type: String,
      enum: ['online', 'offline'],
      required: true,
      default: 'online',
    },
    status: {
      type: String,
      enum: ['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'],
      default: 'scheduled',
      index: true,
    },
    scheduledAt: {
      type: Date,
      required: true,
      index: true,
    },
    durationMinutes: {
      type: Number,
      default: 30,
      min: 5,
      max: 480,
    },
    actualDurationMinutes: Number,
    startedAt: Date,
    endedAt: Date,
    googleMeet: {
      meetLink: String,
      meetId: String,
      conferenceId: String,
      joinUrl: String,
      createdAt: Date,
      expiresAt: Date,
      participantEmails: [String],
      recordingUrl: String,
      recordingAvailable: Boolean,
    },
    googleCalendar: {
      eventId: String,
      calendarId: String,
      htmlLink: String,
      organizerEmail: String,
      attendees: [
        {
          email: String,
          status: {
            type: String,
            enum: ['accepted', 'declined', 'tentative', 'needsAction'],
          },
          displayName: String,
        },
      ],
      reminderMinutes: [Number],
      description: String,
      iCalUID: String,
    },
    location: String,
    locationNotes: String,
    notes: String,
    cancelledBy: String,
    cancellationReason: String,
    cancelledAt: Date,
    noShowReason: String,
    remindersSent: [
      {
        type: {
          type: String,
          enum: ['email', 'sms', 'inapp'],
        },
        sentAt: Date,
        recipientEmail: String,
        recipientPhone: String,
      },
    ],
    followUpConsultationId: String,
    relatedConsultationIds: [String],
    attachments: [
      {
        fileName: String,
        fileUrl: String,
        fileSize: Number,
        mimeType: String,
        uploadedAt: Date,
        uploadedBy: String,
      },
    ],
    metadata: {
      source: {
        type: String,
        enum: ['employee_portal', 'hr_admin', 'clinician', 'automated'],
      },
      employeeSelfScheduled: Boolean,
      priority: {
        type: String,
        enum: ['low', 'normal', 'high', 'urgent'],
        default: 'normal',
      },
      tags: [String],
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    updatedAt: Date,
  },
  {
    timestamps: true,
  }
);

consultationSchema.index({ tenantId: 1, scheduledAt: -1 });
consultationSchema.index({ tenantId: 1, employeeId: 1 });
consultationSchema.index({ tenantId: 1, clinicianId: 1 });
consultationSchema.index({ tenantId: 1, sessionId: 1 });
consultationSchema.index({ status: 1, scheduledAt: 1 });

module.exports = mongoose.model('Consultation', consultationSchema);
