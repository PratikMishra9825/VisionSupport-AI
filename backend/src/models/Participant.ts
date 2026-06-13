import mongoose from 'mongoose';

const participantSchema = new mongoose.Schema({
  sessionId: { type: String, required: true },
  socketId: { type: String, required: true },
  userId: { type: String, required: true },
  name: { type: String, required: true },
  role: { type: String, enum: ['agent', 'customer', 'supervisor', 'observer'], required: true },
  joinTime: { type: Date, default: Date.now },
  leaveTime: { type: Date },
  status: { type: String, enum: ['connected', 'disconnected'], default: 'connected' },
  
  // Real-time analytics
  bitrate: { type: Number, default: 0 },
  packetLoss: { type: Number, default: 0 },
  jitter: { type: Number, default: 0 },
  latency: { type: Number, default: 0 },
});

export const Participant = mongoose.model('Participant', participantSchema);
