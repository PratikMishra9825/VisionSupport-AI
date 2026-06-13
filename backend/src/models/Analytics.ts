import mongoose from 'mongoose';

const analyticsSchema = new mongoose.Schema({
  sessionId: { type: String },
  activeSessions: { type: Number, required: true },
  connectedUsers: { type: Number, required: true },
  cpuUsage: { type: Number, required: true },
  memoryUsageMB: { type: Number, required: true },
  
  bitrateAvg: { type: Number, default: 0 },
  packetLossAvg: { type: Number, default: 0 },
  reconnectCount: { type: Number, default: 0 },
  errorCount: { type: Number, default: 0 },
  
  timestamp: { type: Date, default: Date.now }
});

export const Analytics = mongoose.model('Analytics', analyticsSchema);
