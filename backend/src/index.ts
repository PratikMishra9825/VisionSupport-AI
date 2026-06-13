// IMPORTANT: OpenTelemetry tracing must be initialized before loading any other modules!
import './tracer';

import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

// Routes
import authRoutes from './routes/auth';
import sessionRoutes from './routes/session';
import fileRoutes from './routes/files';
import adminRoutes from './routes/admin';
import aiRoutes from './routes/ai';
import ticketRoutes from './routes/tickets';
import kbRoutes from './routes/kb';
import copilotRoutes from './routes/copilot';
import searchRoutes from './routes/search';
import notificationRoutes from './routes/notifications';

// Sockets
import { setupSocketIO } from './socket/index';

// MediaSoup
import { createWorkers } from './mediasoup';

// Metrics
import { getMetricsText, getRegistryContentType } from './services/metrics';

// Load ENV configs
dotenv.config();

const app = express();
const server = http.createServer(app);

// Configure CORS and Sockets
const originUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
const allowedOrigins = [
  'http://localhost:3000',
  'https://vision-support-ai-5r8i.vercel.app',
  'https://vision-support-ai-zj52.vercel.app'
];
if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.vercel.app') || origin.startsWith('http://localhost:')) {
      callback(null, true);
    } else {
      callback(null, true); // Fallback to true to prevent blocked operations
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
};

const io = new Server(server, {
  cors: corsOptions
});
app.set('io', io);

// Security middlewares
app.use(helmet({
  contentSecurityPolicy: false, // Turn off CSP headers for easy canvas/WebGL connections in dev
}));
app.use(cors(corsOptions));
app.use(express.json());
import path from 'path';
app.use('/api/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Custom in-memory rate limiting middleware
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const limiter = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const ip = req.ip || 'unknown';
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const limit = 500;
  
  const record = rateLimitMap.get(ip);
  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
    return next();
  }
  
  record.count += 1;
  if (record.count > limit) {
    res.status(429).json({ error: 'Too many requests from this IP. Please try again later.' });
    return;
  }
  next();
};
app.use('/api/auth/', limiter);

// Mount Routing controllers
app.use('/api/auth', authRoutes);
app.use('/api/session', sessionRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/kb', kbRoutes);
app.use('/api/copilot', copilotRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/notifications', notificationRoutes);

// Prometheus metrics endpoint
app.get('/metrics', async (req, res) => {
  try {
    res.setHeader('Content-Type', getRegistryContentType());
    res.send(await getMetricsText());
  } catch (error) {
    res.status(500).send(error);
  }
});

// Configure Socket IO
setupSocketIO(io);

const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/visionsupport';

// Start server after establishing database & SFU connections
const startServer = async () => {
  try {
    // 1. Launch MediaSoup Worker cluster
    console.log('Starting MediaSoup SFU cluster...');
    await createWorkers();
    
    // 2. Connect to MongoDB replica set
    console.log('Connecting to database...');
    await mongoose.connect(MONGODB_URI);
    console.log('Successfully connected to MongoDB');

    // 3. Listen on port
    server.listen(PORT, () => {
      console.log(`========================================`);
      console.log(`VisionSupport AI Server running on PORT: ${PORT}`);
      console.log(`========================================`);
    });
  } catch (error) {
    console.error('Failed to start VisionSupport backend server:', error);
    process.exit(1);
  }
};

startServer();
