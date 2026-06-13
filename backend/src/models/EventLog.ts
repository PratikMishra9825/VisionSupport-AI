import mongoose from 'mongoose';

const eventLogSchema = new mongoose.Schema({
  sessionId: { type: String, required: true },
  event: { type: String, required: true }, // e.g., 'session_created', 'user_joined'
  timestamp: { type: Date, default: Date.now },
  details: { type: mongoose.Schema.Types.Mixed }
});

export const EventLog = mongoose.model('EventLog', eventLogSchema);
