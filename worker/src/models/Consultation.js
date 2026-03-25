const mongoose = require('mongoose');

const consultationSchema = new mongoose.Schema({
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
  clinicianId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
  tenantId: mongoose.Schema.Types.ObjectId,
  status: { type: String, enum: ['scheduled', 'confirmed', 'completed', 'cancelled', 'no-show'] },
  scheduledAt: { type: Date, required: true },
  duration: { type: Number, default: 30 },
  remindersSent: [{
    type: { type: String, enum: ['60min', '15min'] },
    sentAt: Date
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

consultationSchema.index({ tenantId: 1, status: 1 });
consultationSchema.index({ employeeId: 1, scheduledAt: -1 });
consultationSchema.index({ clinicianId: 1, scheduledAt: -1 });
consultationSchema.index({ scheduledAt: 1 });

module.exports = mongoose.model('Consultation', consultationSchema);
