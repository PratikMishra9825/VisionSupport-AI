import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  sessionId: { type: String, required: true },
  senderId: { type: String, required: true },
  senderName: { type: String, required: true },
  senderRole: { type: String, enum: ['agent', 'customer', 'supervisor', 'observer'], required: true },
  
  // Encrypted text content
  encryptedText: { type: String, required: true },
  
  reactions: [{
    userId: { type: String },
    emoji: { type: String }, // e.g., '👍', '❤️'
  }],
  readBy: [{
    userId: { type: String },
    readAt: { type: Date, default: Date.now }
  }],
  
  isEdited: { type: Boolean, default: false },
  isDeleted: { type: Boolean, default: false },
  timestamp: { type: Date, default: Date.now },
});

export const Message = mongoose.model('Message', messageSchema);
