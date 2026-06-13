import mongoose from 'mongoose';

const whiteboardSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true },
  
  // Brush strokes and lines path coordinates
  elements: [{
    id: { type: String, required: true },
    type: { type: String, enum: ['pencil', 'rectangle', 'circle', 'line', 'text', 'sticky'], required: true },
    points: [{ x: Number, y: Number }], // Pencil sketch paths
    x: { type: Number },
    y: { type: Number },
    width: { type: Number },
    height: { type: Number },
    color: { type: String, default: '#ffffff' },
    lineWidth: { type: Number, default: 2 },
    text: { type: String }, // Sticky notes / Text content
    createdBy: { type: String },
  }],
  
  updatedAt: { type: Date, default: Date.now }
});

export const Whiteboard = mongoose.model('Whiteboard', whiteboardSchema);
