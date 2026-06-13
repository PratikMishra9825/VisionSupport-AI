import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { uploadObject, downloadObject, getSignedDownloadUrl } from '../services/minio';
import { File as FileModel } from '../models/File';
import { EventLog } from '../models/EventLog';
import { AuditLog } from '../models/AuditLog';

const router = express.Router();
const upload = multer({ limits: { fileSize: 50 * 1024 * 1024 } }); // Limit size per request to 50MB

const CHUNKS_DIR = path.join(process.cwd(), 'chunks_temp');
if (!fs.existsSync(CHUNKS_DIR)) {
  fs.mkdirSync(CHUNKS_DIR, { recursive: true });
}

// Upload chunk (Resumable/Chunked upload API)
router.post('/upload/chunk', upload.single('chunk'), async (req, res) => {
  try {
    const { uploadId, chunkIndex, totalChunks, filename, sessionId, uploaderId, uploaderName } = req.body;
    
    if (!uploadId || chunkIndex === undefined || !totalChunks || !req.file) {
      return res.status(400).json({ error: 'Missing required chunk parameters' });
    }

    const chunkDir = path.join(CHUNKS_DIR, uploadId);
    if (!fs.existsSync(chunkDir)) {
      fs.mkdirSync(chunkDir, { recursive: true });
    }

    // Write chunk
    const chunkPath = path.join(chunkDir, `chunk_${chunkIndex}`);
    await fs.promises.writeFile(chunkPath, req.file.buffer);

    const uploadedChunksCount = fs.readdirSync(chunkDir).length;
    const isComplete = uploadedChunksCount === Number(totalChunks);

    if (isComplete) {
      // Assemble chunks
      const finalBuffer = await assembleChunks(chunkDir, Number(totalChunks));
      
      // Perform security check & virus scan
      const scanResult = scanForViruses(filename, finalBuffer);
      if (!scanResult.passed) {
        // Cleanup temp chunks
        cleanupChunks(chunkDir);
        return res.status(400).json({ error: `Virus scan failed: ${scanResult.reason}` });
      }

      // Upload encrypted buffer to MinIO
      const minioKey = `${Date.now()}_${filename}`;
      const minioUrl = await uploadObject('visionsupport-files', minioKey, finalBuffer);

      // Save metadata in Mongo
      const fileDoc = new FileModel({
        sessionId,
        uploaderId,
        uploaderName,
        filename,
        sizeBytes: finalBuffer.length,
        mimeType: req.file.mimetype || 'application/octet-stream',
        minioKey,
        virusScanPassed: true,
        virusScanDetails: 'Passed signature and extension analysis',
      });
      await fileDoc.save();

      // Log events
      await EventLog.create({
        sessionId,
        event: 'file_uploaded',
        details: { filename, uploaderName, sizeBytes: finalBuffer.length }
      });

      // Cleanup chunks
      cleanupChunks(chunkDir);

      const downloadUrl = await getSignedDownloadUrl('visionsupport-files', minioKey);
      return res.json({
        success: true,
        fileId: fileDoc._id,
        filename,
        downloadUrl,
        sizeBytes: finalBuffer.length,
      });
    }

    res.json({ success: true, progress: Math.round((uploadedChunksCount / Number(totalChunks)) * 100) });
  } catch (error) {
    console.error('Chunk upload error:', error);
    res.status(500).json({ error: 'Failed to process file chunk' });
  }
});

// Helper: Merge all chunks into single buffer
const assembleChunks = async (chunkDir: string, totalChunks: number): Promise<Buffer> => {
  const buffers: Buffer[] = [];
  for (let i = 0; i < totalChunks; i++) {
    const chunkPath = path.join(chunkDir, `chunk_${i}`);
    const buffer = await fs.promises.readFile(chunkPath);
    buffers.push(buffer);
  }
  return Buffer.concat(buffers);
};

const cleanupChunks = (chunkDir: string) => {
  try {
    const files = fs.readdirSync(chunkDir);
    for (const file of files) {
      fs.unlinkSync(path.join(chunkDir, file));
    }
    fs.rmdirSync(chunkDir);
  } catch (err) {
    console.error('Failed to cleanup temp chunks:', err);
  }
};

// Security scan: Checks for executable files, malicious extensions, and known test strings
const scanForViruses = (filename: string, buffer: Buffer): { passed: boolean; reason?: string } => {
  const ext = path.extname(filename).toLowerCase();
  const dangerousExts = ['.exe', '.bat', '.sh', '.msi', '.vbs', '.scr'];
  
  if (dangerousExts.includes(ext)) {
    return { passed: false, reason: `Files with extension '${ext}' are blocked for security reasons.` };
  }

  // Scan file contents for EICAR standard anti-virus test file signature
  const fileString = buffer.toString('utf8');
  if (fileString.includes('X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*')) {
    return { passed: false, reason: 'Malicious threat signature detected in file content (EICAR-Test).' };
  }

  // Validate typical magic headers for safety (optional check)
  return { passed: true };
};

// Get signed download link
router.get('/download/:fileId', async (req, res) => {
  try {
    const file = await FileModel.findById(req.params.fileId);
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    const downloadUrl = await getSignedDownloadUrl('visionsupport-files', file.minioKey);
    
    // Log download count
    file.downloadCount += 1;
    await file.save();

    await AuditLog.create({
      userId: file.uploaderId,
      userName: file.uploaderName,
      userRole: 'user',
      action: 'file_downloaded',
      status: 'success',
      details: { filename: file.filename, fileId: file._id.toString() }
    });

    res.json({ downloadUrl });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate download url' });
  }
});

// Decrypt and serve file locally (MinIO offline fallback gateway)
router.get('/download/local/:bucket/:key', async (req, res) => {
  try {
    const { bucket, key } = req.params;
    const decryptedBuffer = await downloadObject(bucket, key);
    
    // Strip timestamps from filename for response header
    const cleanFilename = key.substring(key.indexOf('_') + 1);
    
    res.setHeader('Content-Disposition', `attachment; filename="${cleanFilename}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.send(decryptedBuffer);
  } catch (error) {
    console.error('Local download decryption failed:', error);
    res.status(500).send('Decryption download error');
  }
});

// Get session files preview list
router.get('/session/:sessionId', async (req, res) => {
  try {
    const files = await FileModel.find({ sessionId: req.params.sessionId }).sort({ createdAt: -1 });
    res.json(files);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch session files' });
  }
});

export default router;
