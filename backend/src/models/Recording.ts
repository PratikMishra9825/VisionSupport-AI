import mongoose, { Document } from 'mongoose';

export interface IRecording extends Document {
  sessionId: string;
  recordingId: string;
  status: 'recording' | 'processing' | 'ready';
  videoUrl?: string;
  thumbnailUrl?: string;
  duration: number;
  participants?: Array<{ name: string; role: string }>;
  markers: Array<{
    time: number;
    type: 'pause' | 'resume' | 'bookmark' | 'annotation' | 'problem_discovery' | 'resolution' | 'critical_message' | 'screenshot';
    description: string;
  }>;
  createdAt: Date;
  expiresAt?: Date;
}

const recordingSchema = new mongoose.Schema<IRecording>({
  sessionId: { type: String, required: true },
  recordingId: { type: String, required: true, unique: true },
  status: { type: String, enum: ['recording', 'processing', 'ready'], default: 'recording' },
  videoUrl: { type: String },
  thumbnailUrl: { type: String },
  duration: { type: Number, default: 0 }, // in seconds
  participants: [{
    name: { type: String },
    role: { type: String }
  }],
  
  // Custom markers/annotations
  markers: [{

    time: { type: Number }, // in milliseconds since start
    type: { type: String }, // e.g. 'pause', 'resume', 'bookmark', 'annotation'
    description: { type: String }
  }],
  
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date } // TTL for retention policy (e.g. 30 days)
});

// Configure automatic TTL deletion index (MongoDB handles this if document expires)
recordingSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Recording = mongoose.model<IRecording>('Recording', recordingSchema);

