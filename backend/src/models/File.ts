import mongoose from 'mongoose';

const fileSchema = new mongoose.Schema({
  sessionId: { type: String, required: true },
  uploaderId: { type: String, required: true },
  uploaderName: { type: String, required: true },
  
  filename: { type: String, required: true },
  sizeBytes: { type: Number, required: true },
  mimeType: { type: String, required: true },
  minioKey: { type: String, required: true },
  
  // Security checks
  virusScanPassed: { type: Boolean, default: false },
  virusScanDetails: { type: String, default: 'Pending scan' },
  
  downloadCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

export const File = mongoose.model('File', fileSchema);
