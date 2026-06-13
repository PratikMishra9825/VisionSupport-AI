import mongoose, { Document } from 'mongoose';

export interface INotification extends Document {
  agentId: string;
  title: string;
  body: string;
  type: 'session_request' | 'ticket_update' | 'recording_ready' | 'rating' | 'ai_insight';
  read: boolean;
  createdAt: Date;
}

const notificationSchema = new mongoose.Schema<INotification>({
  agentId: { type: String, required: true },
  title: { type: String, required: true },
  body: { type: String, required: true },
  type: {
    type: String,
    enum: ['session_request', 'ticket_update', 'recording_ready', 'rating', 'ai_insight'],
    required: true
  },
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

export const Notification = mongoose.model<INotification>('Notification', notificationSchema);
