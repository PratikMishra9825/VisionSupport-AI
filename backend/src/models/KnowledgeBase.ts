import mongoose from 'mongoose';

const knowledgeBaseSchema = new mongoose.Schema({
  articleId: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  problemDescription: { type: String, required: true },
  solution: { type: String, required: true },
  category: { type: String, default: 'General Support' },
  tags: [{ type: String }],
  ticketId: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Add index for text search
knowledgeBaseSchema.index({ title: 'text', problemDescription: 'text', solution: 'text' });

export const KnowledgeBase = mongoose.model('KnowledgeBase', knowledgeBaseSchema);
