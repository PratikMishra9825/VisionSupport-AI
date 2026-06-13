import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  userName: { type: String, required: true },
  userRole: { type: String, required: true },
  action: { type: String, required: true }, // e.g. 'login_attempt', 'recording_started', 'file_downloaded'
  status: { type: String, enum: ['success', 'failure'], required: true },
  ipAddress: { type: String },
  details: { type: mongoose.Schema.Types.Mixed },
  timestamp: { type: Date, default: Date.now }
});

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
