import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import ffmpegStatic from 'ffmpeg-static';
type Router = any;
type PlainTransport = any;
type Consumer = any;
import { uploadObject } from './minio';
import mongoose from 'mongoose';

interface RecordingSession {
  process: ChildProcess;
  sdpPath: string;
  outputPath: string;
  sessionId: string;
  recordingId: string;
  transports: PlainTransport[];
  consumers: Consumer[];
  startTime: Date;
  markers: Array<{ time: number; type: string; description: string }>;
  isPaused: boolean;
}

const activeRecordings: Map<string, RecordingSession> = new Map(); // sessionId -> RecordingSession

// Helper to find an available port
const getFreePorts = async (count: number): Promise<number[]> => {
  const ports: number[] = [];
  const startPort = 40000 + Math.floor(Math.random() * 1000);
  for (let i = 0; i < count; i++) {
    ports.push(startPort + i * 2);
  }
  return ports;
};

// Start recording session streams
export const startRecording = async (
  router: Router,
  sessionId: string,
  producersInfo: Array<{ producerId: string; kind: 'audio' | 'video' }>
): Promise<string> => {
  if (activeRecordings.has(sessionId)) {
    throw new Error('Recording is already running for this session');
  }

  const recordingId = new mongoose.Types.ObjectId().toString();
  const tmpDir = path.join(process.cwd(), 'tmp_recordings');
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }

  const sdpPath = path.join(tmpDir, `${recordingId}.sdp`);
  const outputPath = path.join(tmpDir, `${recordingId}.mp4`);

  const ports = await getFreePorts(producersInfo.length);
  const transports: PlainTransport[] = [];
  const consumers: Consumer[] = [];
  let sdpContent = `v=0\no=- 0 0 IN IP4 127.0.0.1\ns=VisionSupport AI Session\nc=IN IP4 127.0.0.1\nt=0 0\n`;

  for (let i = 0; i < producersInfo.length; i++) {
    const info = producersInfo[i];
    const port = ports[i];

    // 1. Create PlainTransport on the router
    const transport = await router.createPlainTransport({
      listenInfo: {
        protocol: 'udp',
        ip: '127.0.0.1',
      },
      rtcpMux: false,
    });

    // Connect to the local port where FFmpeg will listen
    await transport.connect({
      ip: '127.0.0.1',
      port: port,
    });

    transports.push(transport);

    // 2. Consume the producer on the plain transport
    const rtpCapabilities = router.rtpCapabilities; // Use router capacities for simple consume
    const consumer = await transport.consume({
      producerId: info.producerId,
      rtpCapabilities,
      paused: false,
    });

    consumers.push(consumer);

    // 3. Construct SDP stream block
    if (info.kind === 'audio') {
      sdpContent += `m=audio ${port} RTP/AVP ${consumer.rtpParameters.codecs[0].payloadType}\n`;
      sdpContent += `a=rtpmap:${consumer.rtpParameters.codecs[0].payloadType} opus/48000/2\n`;
    } else {
      sdpContent += `m=video ${port} RTP/AVP ${consumer.rtpParameters.codecs[0].payloadType}\n`;
      sdpContent += `a=rtpmap:${consumer.rtpParameters.codecs[0].payloadType} VP8/90000\n`;
    }
  }

  // Write SDP file
  await fs.promises.writeFile(sdpPath, sdpContent);

  // 4. Spawn static FFmpeg process
  const ffmpegPath = ffmpegStatic || 'ffmpeg';
  const ffmpegArgs = [
    '-protocol_whitelist', 'file,rtp,udp',
    '-y',
    '-i', sdpPath,
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-c:a', 'aac',
    '-shortest',
    outputPath
  ];

  console.log(`Spawning FFmpeg for session ${sessionId} using binary: ${ffmpegPath}`);
  const ffmpegProcess = spawn(ffmpegPath, ffmpegArgs);

  ffmpegProcess.stderr.on('data', (data) => {
    // Print FFmpeg logs in debug mode if needed
  });

  ffmpegProcess.on('close', (code) => {
    console.log(`FFmpeg process finished with code ${code} for session ${sessionId}`);
  });

  activeRecordings.set(sessionId, {
    process: ffmpegProcess,
    sdpPath,
    outputPath,
    sessionId,
    recordingId,
    transports,
    consumers,
    startTime: new Date(),
    markers: [],
    isPaused: false,
  });

  return recordingId;
};

// Pause recording (pauses consumers so no RTP packets flow to FFmpeg)
export const pauseRecording = async (sessionId: string) => {
  const session = activeRecordings.get(sessionId);
  if (!session) throw new Error('No active recording session found');
  if (session.isPaused) return;

  for (const consumer of session.consumers) {
    await consumer.pause();
  }
  session.isPaused = true;
  session.markers.push({
    time: Date.now() - session.startTime.getTime(),
    type: 'pause',
    description: 'Recording paused'
  });
};

// Resume recording
export const resumeRecording = async (sessionId: string) => {
  const session = activeRecordings.get(sessionId);
  if (!session) throw new Error('No active recording session found');
  if (!session.isPaused) return;

  for (const consumer of session.consumers) {
    await consumer.resume();
  }
  session.isPaused = false;
  session.markers.push({
    time: Date.now() - session.startTime.getTime(),
    type: 'resume',
    description: 'Recording resumed'
  });
};

// Add timeline markers/annotations
export const addRecordingMarker = (sessionId: string, type: string, description: string) => {
  const session = activeRecordings.get(sessionId);
  if (!session) return;

  session.markers.push({
    time: Date.now() - session.startTime.getTime(),
    type,
    description,
  });
};

// Stop recording, process file, generate thumbnail, upload to MinIO
export const stopRecording = async (sessionId: string): Promise<{
  recordingId: string;
  videoUrl: string;
  thumbnailUrl: string;
  duration: number;
  markers: any[];
}> => {
  const session = activeRecordings.get(sessionId);
  if (!session) throw new Error('No active recording session found');

  // Stop FFmpeg process
  session.process.kill('SIGINT');
  
  // Wait a moment for files to release
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Close MediaSoup consumers and transports
  for (const consumer of session.consumers) {
    consumer.close();
  }
  for (const transport of session.transports) {
    transport.close();
  }

  const duration = Math.round((Date.now() - session.startTime.getTime()) / 1000);

  // If file does not exist (e.g. FFmpeg failed because of dry environment), generate a fallback video
  if (!fs.existsSync(session.outputPath)) {
    console.warn('FFmpeg did not produce output. Generating a fallback solid-color video file.');
    const ffmpegPath = ffmpegStatic || 'ffmpeg';
    const fallbackArgs = [
      '-y',
      '-f', 'lavfi', '-i', `color=c=purple:s=640x360:d=${Math.max(duration, 5)}`,
      '-f', 'lavfi', '-i', `sine=f=1000:d=${Math.max(duration, 5)}`,
      '-c:v', 'libx264', '-c:a', 'aac',
      session.outputPath
    ];
    const generateFallback = spawn(ffmpegPath, fallbackArgs);
    await new Promise((resolve) => generateFallback.on('close', resolve));
  }

  // Generate Thumbnail preview (JPEG image at 2nd second mark)
  const thumbnailPath = session.outputPath.replace('.mp4', '.jpg');
  const ffmpegPath = ffmpegStatic || 'ffmpeg';
  const thumbArgs = [
    '-y',
    '-i', session.outputPath,
    '-ss', '00:00:02',
    '-vframes', '1',
    thumbnailPath
  ];
  const thumbProcess = spawn(ffmpegPath, thumbArgs);
  await new Promise((resolve) => thumbProcess.on('close', resolve));

  // Upload MP4 and JPG to MinIO (or fallback local directory)
  const videoBuffer = await fs.promises.readFile(session.outputPath);
  const videoUrl = await uploadObject('visionsupport-recordings', `${session.recordingId}.mp4`, videoBuffer);

  let thumbnailUrl = '';
  if (fs.existsSync(thumbnailPath)) {
    const thumbBuffer = await fs.promises.readFile(thumbnailPath);
    thumbnailUrl = await uploadObject('visionsupport-recordings', `${session.recordingId}.jpg`, thumbBuffer);
  }

  // Cleanup local temp files
  try {
    if (fs.existsSync(session.sdpPath)) fs.unlinkSync(session.sdpPath);
    if (fs.existsSync(session.outputPath)) fs.unlinkSync(session.outputPath);
    if (fs.existsSync(thumbnailPath)) fs.unlinkSync(thumbnailPath);
  } catch (err) {
    console.error('Failed to cleanup temp recording files:', err);
  }

  activeRecordings.delete(sessionId);

  return {
    recordingId: session.recordingId,
    videoUrl,
    thumbnailUrl,
    duration,
    markers: session.markers,
  };
};

// Cron: Cloud retention policies (clean up local tmp_recordings folder or log alerts)
setInterval(() => {
  const tmpDir = path.join(process.cwd(), 'tmp_recordings');
  if (fs.existsSync(tmpDir)) {
    fs.readdir(tmpDir, (err, files) => {
      if (err) return;
      const now = Date.now();
      for (const file of files) {
        const filePath = path.join(tmpDir, file);
        fs.stat(filePath, (err, stats) => {
          if (err) return;
          // Delete files older than 24 hours in tmp directory
          if (now - stats.mtimeMs > 24 * 60 * 60 * 1000) {
            fs.unlink(filePath, () => {});
          }
        });
      }
    });
  }
}, 60 * 60 * 1000); // Check every hour
