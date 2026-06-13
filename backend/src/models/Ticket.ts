import mongoose from 'mongoose';

const ticketSchema = new mongoose.Schema({
  ticketId: { type: String, required: true, unique: true },
  sessionId: { type: String, required: true },
  customerName: { type: String, default: 'Anonymous Guest' },
  agentName: { type: String, default: 'Support Agent' },
  issueTitle: { type: String, required: true },
  problemDescription: { type: String },
  rootCause: { type: String },
  solution: { type: String },
  priority: { type: String, enum: ['Low', 'Medium', 'High'], default: 'Medium' },
  status: { type: String, enum: ['Open', 'Resolved', 'Closed'], default: 'Open' },
  category: { type: String, default: 'General Support' },
  createdTime: { type: Date, default: Date.now },
  closedTime: { type: Date },
  sessionDuration: { type: Number, default: 0 }, // in seconds
  recordingLink: { type: String },
  sharedFiles: [{ type: String }],
  transcriptReference: { type: String } // Plain text or ID
});

export const Ticket = mongoose.model('Ticket', ticketSchema);
