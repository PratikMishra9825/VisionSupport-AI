import mongoose, { Document } from 'mongoose';

export interface ISession extends Document {
  sessionId: string;
  agentId: string;
  inviteToken: string;
  status: 'active' | 'ended';
  createdAt: Date;
  endedAt?: Date;
  csatRating?: number;
  csatFeedback?: string;
  resolutionDuration?: number;
  responseTime?: number;
  portalToken?: string;
  participants: Array<{
    role: 'agent' | 'customer' | 'supervisor' | 'observer';
    joinTime: Date;
    leaveTime?: Date;
    duration?: number;
  }>;
}

const sessionSchema = new mongoose.Schema<ISession>({
  sessionId: { type: String, required: true, unique: true },
  agentId: { type: String, required: true },
  inviteToken: { type: String, required: true },
  status: { type: String, enum: ['active', 'ended'], default: 'active' },
  csatRating: { type: Number },
  csatFeedback: { type: String },
  resolutionDuration: { type: Number },
  responseTime: { type: Number },
  portalToken: { type: String },
  createdAt: { type: Date, default: Date.now },
  endedAt: { type: Date },
  participants: [{
    role: { type: String, enum: ['agent', 'customer', 'supervisor', 'observer'] },
    joinTime: { type: Date, default: Date.now },
    leaveTime: { type: Date },
    duration: { type: Number } // in seconds
  }]
});


export const Session = mongoose.model<ISession>('Session', sessionSchema);

