import * as mediasoup from 'mediasoup';
export type Worker = any;
export type Router = any;
import os from 'os';

let workers: Worker[] = [];
let nextMediasoupWorkerIdx = 0;
const routers: Map<string, Router> = new Map(); // sessionId -> Router

export const createWorkers = async () => {
  const numWorkers = Object.keys(os.cpus()).length;
  for (let i = 0; i < numWorkers; i++) {
    const worker = await mediasoup.createWorker({
      logLevel: 'warn',
      logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtcp'],
      rtcMinPort: Number(process.env.MEDIASOUP_MIN_PORT) || 10000,
      rtcMaxPort: Number(process.env.MEDIASOUP_MAX_PORT) || 10100,
    });
    
    worker.on('died', () => {
      console.error(`mediasoup worker died, exiting in 2 seconds... [pid:${worker.pid}]`);
      setTimeout(() => process.exit(1), 2000);
    });

    workers.push(worker);
  }
};

const getNextWorker = () => {
  const worker = workers[nextMediasoupWorkerIdx];
  if (++nextMediasoupWorkerIdx === workers.length) nextMediasoupWorkerIdx = 0;
  return worker;
};

export const createRoomRouter = async (sessionId: string): Promise<Router> => {
  if (routers.has(sessionId)) {
    return routers.get(sessionId)!;
  }

  const worker = getNextWorker();
  const router = await worker.createRouter({
    mediaCodecs: [
      {
        kind: 'audio',
        mimeType: 'audio/opus',
        clockRate: 48000,
        channels: 2
      },
      {
        kind: 'video',
        mimeType: 'video/VP8',
        clockRate: 90000,
        parameters: {
          'x-google-start-bitrate': 1000
        }
      }
    ]
  });

  routers.set(sessionId, router);
  return router;
};

export const getRouter = (sessionId: string) => {
  return routers.get(sessionId);
};
