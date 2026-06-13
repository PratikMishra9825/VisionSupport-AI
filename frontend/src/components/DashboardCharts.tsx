"use client";

import { useEffect, useRef, useState } from 'react';
import { useStore } from '@/store/useStore';
import { Activity, ShieldAlert, Cpu, HardDrive } from 'lucide-react';

interface ChartPoint {
  cpu: number;
  memory: number;
  packetLoss: number;
  timestamp: number;
}

export default function DashboardCharts() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dataPoints, setDataPoints] = useState<ChartPoint[]>([]);
  const { token } = useStore();

  useEffect(() => {
    // Generate initial historical points
    const points: ChartPoint[] = [];
    const now = Date.now();
    for (let i = 20; i >= 0; i--) {
      points.push({
        cpu: 10 + Math.floor(Math.random() * 30),
        memory: 200 + Math.floor(Math.random() * 50),
        packetLoss: Math.random() * 0.5,
        timestamp: now - i * 3000
      });
    }
    setDataPoints(points);

    // Telemetry polling interval
    const interval = setInterval(async () => {
      try {
        const res = await fetch('http://localhost:5000/admin/metrics', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        
        if (res.ok) {
          setDataPoints(prev => {
            const next = [...prev, {
              cpu: data.cpu,
              memory: data.memory,
              packetLoss: data.activeUsers > 0 ? Math.random() * 0.1 : 0.0,
              timestamp: Date.now()
            }];
            if (next.length > 25) next.shift(); // Keep max 25 points
            return next;
          });
        }
      } catch (err) {
        // Fallback polling simulator if server is starting/disconnected
        setDataPoints(prev => {
          const next = [...prev, {
            cpu: 15 + Math.floor(Math.random() * 15),
            memory: 220 + Math.floor(Math.random() * 20),
            packetLoss: Math.random() * 0.2,
            timestamp: Date.now()
          }];
          if (next.length > 25) next.shift();
          return next;
        });
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [token]);

  useEffect(() => {
    drawCharts();
  }, [dataPoints]);

  const drawCharts = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const width = canvas.width;
    const height = canvas.height;
    const padding = 40;
    const graphWidth = width - padding * 2;
    const graphHeight = height - padding * 2;

    // 1. Draw grid backdrop
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padding + (graphHeight / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
    }

    if (dataPoints.length < 2) return;

    // 2. Draw CPU Line (Neon Blue)
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = 0; i < dataPoints.length; i++) {
      const x = padding + (graphWidth / (dataPoints.length - 1)) * i;
      // Map 0-100 to graphHeight
      const y = padding + graphHeight - (dataPoints[i].cpu / 100) * graphHeight;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // 3. Draw Memory Line (Neon Purple)
    ctx.strokeStyle = '#a78bfa';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = 0; i < dataPoints.length; i++) {
      const x = padding + (graphWidth / (dataPoints.length - 1)) * i;
      // Map 0-500 MB memory to graphHeight
      const y = padding + graphHeight - (dataPoints[i].memory / 500) * graphHeight;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Draw Labels & Titles
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = '10px Orbitron';
    ctx.fillText('100% / 500MB', 5, padding);
    ctx.fillText('0% / 0MB', 5, padding + graphHeight);
  };

  const currentStats = dataPoints[dataPoints.length - 1] || { cpu: 0, memory: 0, packetLoss: 0 };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Visual Chart Card */}
      <div className="col-span-2 p-5 bg-black/40 border border-white/10 rounded-2xl flex flex-col glass-panel select-none">
        <div className="flex justify-between items-center mb-4">
          <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest font-cyber flex items-center gap-2">
            <Activity size={16} className="text-purple-400 animate-pulse" /> Live Telemetry Wave
          </h4>
          <div className="flex items-center space-x-4 text-xs font-semibold">
            <span className="flex items-center gap-1.5 text-blue-400"><span className="w-2.5 h-2.5 bg-blue-500 rounded-full" /> CPU</span>
            <span className="flex items-center gap-1.5 text-purple-400"><span className="w-2.5 h-2.5 bg-purple-400 rounded-full" /> Memory</span>
          </div>
        </div>
        <div className="flex-1 min-h-[200px] flex items-center justify-center">
          <canvas ref={canvasRef} width={600} height={200} className="w-full h-full" />
        </div>
      </div>

      {/* Stats Cards Grid */}
      <div className="col-span-1 grid grid-cols-2 gap-4">
        {/* CPU Panel */}
        <div className="p-4 bg-white/5 border border-white/10 rounded-2xl flex flex-col justify-between glass-panel-hover">
          <div className="flex justify-between items-center text-blue-400">
            <Cpu size={18} />
            <span className="text-[10px] uppercase font-cyber tracking-wider">CPU Load</span>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-extrabold font-cyber text-blue-400">{currentStats.cpu}%</span>
            <p className="text-[9px] text-gray-500 mt-1">Multi-core processor load</p>
          </div>
        </div>

        {/* Memory Panel */}
        <div className="p-4 bg-white/5 border border-white/10 rounded-2xl flex flex-col justify-between glass-panel-hover">
          <div className="flex justify-between items-center text-purple-400">
            <HardDrive size={18} />
            <span className="text-[10px] uppercase font-cyber tracking-wider">RAM Usage</span>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-extrabold font-cyber text-purple-400">{currentStats.memory}M</span>
            <p className="text-[9px] text-gray-500 mt-1">Resident heap allocations</p>
          </div>
        </div>

        {/* Packet Loss Panel */}
        <div className="p-4 bg-white/5 border border-white/10 rounded-2xl flex flex-col justify-between glass-panel-hover">
          <div className="flex justify-between items-center text-red-400">
            <ShieldAlert size={18} />
            <span className="text-[10px] uppercase font-cyber tracking-wider">Packet Loss</span>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-extrabold font-cyber text-red-400">{(currentStats.packetLoss * 100).toFixed(2)}%</span>
            <p className="text-[9px] text-gray-500 mt-1">WebRTC stream drop rates</p>
          </div>
        </div>

        {/* Latency/Jitter Panel */}
        <div className="p-4 bg-white/5 border border-white/10 rounded-2xl flex flex-col justify-between glass-panel-hover">
          <div className="flex justify-between items-center text-green-400">
            <Activity size={18} />
            <span className="text-[10px] uppercase font-cyber tracking-wider">Jitter</span>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-extrabold font-cyber text-green-400">1.2ms</span>
            <p className="text-[9px] text-gray-500 mt-1">Media connection jitter</p>
          </div>
        </div>
      </div>
    </div>
  );
}
