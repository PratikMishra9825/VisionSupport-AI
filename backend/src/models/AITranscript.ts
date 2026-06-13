import mongoose from 'mongoose';

const aiTranscriptSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true },
  
  // Array of spoken segments
  segments: [{
    speakerId: { type: String, required: true },
    speakerName: { type: String, required: true },
    speakerRole: { type: String, required: true },
    text: { type: String, required: true }, // Encrypted at rest
    translation: {
      language: { type: String },
      text: { type: String }
    },
    timestamp: { type: Date, default: Date.now }
  }],
  
  // AI analysis items
  summary: { type: String },
  sentiment: { type: String, enum: ['positive', 'neutral', 'negative', 'pending'], default: 'pending' },
  sentimentScore: { type: Number, default: 0.0 },
  actionItems: [{ type: String }],
  
  ticketGenerated: {
    ticketId: { type: String },
    title: { type: String },
    description: { type: String },
    priority: { type: String, enum: ['Low', 'Medium', 'High'] },
    status: { type: String, default: 'Open' }
  },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export const AITranscript = mongoose.model('AITranscript', aiTranscriptSchema);
