import mongoose from 'mongoose';

const screenShareSchema = new mongoose.Schema({
  sessionId: { type: String, required: true },
  userId: { type: String, required: true },
  userName: { type: String, required: true },
  producerId: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  startedAt: { type: Date, default: Date.now },
  endedAt: { type: Date }
});

export const ScreenShare = mongoose.model('ScreenShare', screenShareSchema);
