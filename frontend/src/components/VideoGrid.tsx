"use client";

import { useEffect, useRef, useState, memo } from 'react';
import { useStore } from '@/store/useStore';
import { Mic, MicOff, Video, VideoOff, Wifi, ShieldAlert, Sliders, Tv, PenTool, Circle, Sparkles } from 'lucide-react';
import { Socket } from 'socket.io-client';
import { motion } from 'framer-motion';

interface VideoGridProps {
  localStream: MediaStream | null;
  remoteStreams: Map<string, { stream: MediaStream; name: string; role: string }>;
  micEnabled: boolean;
  camEnabled: boolean;
  toggleMic: () => void;
  toggleCam: () => void;
  audioConstraints: { echoCancellation: boolean; noiseSuppression: boolean; autoGainControl: boolean };
  updateAudioConstraints: (key: string, val: boolean) => void;
  screenSharing?: boolean;
  toggleScreenShare?: () => void;
  socket: Socket | null;
}

const VideoGrid = memo(function VideoGrid({
  localStream,
  remoteStreams,
  micEnabled,
  camEnabled,
  toggleMic,
  toggleCam,
  audioConstraints,
  updateAudioConstraints,
  screenSharing = false,
  toggleScreenShare,
  socket,
}: VideoGridProps) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localWaveformRef = useRef<HTMLCanvasElement>(null);
  
  const { participants, role, name } = useStore();
  const [localSpeaking, setLocalSpeaking] = useState(false);
  const [showFiltersMenu, setShowFiltersMenu] = useState(false);

  // Screen Share annotations states
  const [drawMode, setDrawMode] = useState<'laser' | 'circle' | 'highlight' | 'none'>('none');
  const [annotations, setAnnotations] = useState<any[]>([]);
  const [isDrawingOverlay, setIsDrawingOverlay] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<any[]>([]);
  const [startCoords, setStartCoords] = useState<{ x: number; y: number } | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!socket) return;
    
    socket.on('remote-annotation', ({ annotation }) => {
      if (annotation.type === 'clear') {
        setAnnotations([]);
      } else {
        setAnnotations(prev => [...prev, annotation]);
      }
    });

    return () => {
      socket.off('remote-annotation');
    };
  }, [socket]);

  // Redraw annotations on the overlay canvas
  useEffect(() => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    annotations.forEach(anno => {
      ctx.strokeStyle = anno.color || '#ef4444';
      ctx.lineWidth = anno.lineWidth || 3;
      ctx.fillStyle = anno.color || '#ef4444';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (anno.type === 'circle') {
        ctx.beginPath();
        ctx.arc(anno.x, anno.y, anno.radius, 0, 2 * Math.PI);
        ctx.stroke();
      } else if (anno.type === 'highlight') {
        if (anno.points && anno.points.length > 0) {
          ctx.beginPath();
          ctx.moveTo(anno.points[0].x, anno.points[0].y);
          for (let i = 1; i < anno.points.length; i++) {
            ctx.lineTo(anno.points[i].x, anno.points[i].y);
          }
          ctx.stroke();
        }
      } else if (anno.type === 'laser') {
        ctx.beginPath();
        ctx.arc(anno.x, anno.y, 6, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(anno.x, anno.y, 12, 0, 2 * Math.PI);
        ctx.stroke();
      }
    });
  }, [annotations]);

  const getOverlayCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 640;
    const y = ((e.clientY - rect.top) / rect.height) * 480;
    return { x, y };
  };

  const handleOverlayMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (drawMode === 'none') return;
    const coords = getOverlayCoords(e);
    setIsDrawingOverlay(true);
    
    if (drawMode === 'circle') {
      setStartCoords(coords);
    } else if (drawMode === 'highlight') {
      setCurrentPoints([coords]);
    } else if (drawMode === 'laser') {
      const annotation = { type: 'laser', x: coords.x, y: coords.y, color: '#ef4444' };
      setAnnotations(prev => [...prev, annotation]);
      socket?.emit('screen-annotation', { annotation });
    }
  };

  const handleOverlayMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (drawMode === 'none') return;
    const coords = getOverlayCoords(e);

    if (drawMode === 'laser') {
      socket?.emit('laser-pointer', { x: coords.x, y: coords.y, isDrawing: isDrawingOverlay });
    }

    if (!isDrawingOverlay) return;

    if (drawMode === 'highlight') {
      setCurrentPoints(prev => [...prev, coords]);
      const annotation = { type: 'highlight', points: [...currentPoints, coords], color: '#facc15', lineWidth: 4 };
      setAnnotations(prev => {
        const base = prev.filter(a => a.active !== true);
        return [...base, { ...annotation, active: true }];
      });
    }
  };

  const handleOverlayMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingOverlay || drawMode === 'none') return;
    setIsDrawingOverlay(false);
    const coords = getOverlayCoords(e);

    if (drawMode === 'circle' && startCoords) {
      const dx = coords.x - startCoords.x;
      const dy = coords.y - startCoords.y;
      const radius = Math.sqrt(dx * dx + dy * dy);
      const annotation = { type: 'circle', x: startCoords.x, y: startCoords.y, radius, color: '#3b82f6', lineWidth: 3 };
      
      setAnnotations(prev => [...prev, annotation]);
      socket?.emit('screen-annotation', { annotation });
      setStartCoords(null);
    } else if (drawMode === 'highlight' && currentPoints.length > 0) {
      const annotation = { type: 'highlight', points: [...currentPoints, coords], color: '#facc15', lineWidth: 4 };
      
      setAnnotations(prev => {
        const base = prev.filter(a => a.active !== true);
        return [...base, annotation];
      });
      socket?.emit('screen-annotation', { annotation });
      setCurrentPoints([]);
    }
  };

  // Attach local camera stream
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, camEnabled]);

  // Audio Context analyzer for local voice activity rings & waveform visualizer
  useEffect(() => {
    if (!localStream || !micEnabled) {
      setLocalSpeaking(false);
      return;
    }

    const audioTracks = localStream.getAudioTracks();
    if (audioTracks.length === 0) return;

    let audioContext: AudioContext | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    let analyser: AnalyserNode | null = null;
    let animationFrameId = 0;

    try {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source = audioContext.createMediaStreamSource(localStream);
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const checkVolume = () => {
        if (!analyser) return;
        analyser.getByteFrequencyData(dataArray);
        
        // Average volume
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;

        // Trigger active voice speaker rings
        setLocalSpeaking(average > 30);

        // Draw local microphone waveform waves onto canvas
        const canvas = localWaveformRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.strokeStyle = '#8b5cf6';
            ctx.lineWidth = 2;
            ctx.beginPath();
            const sliceWidth = canvas.width / bufferLength;
            let x = 0;
            for (let i = 0; i < bufferLength; i++) {
              const v = dataArray[i] / 128.0;
              const y = (v * canvas.height) / 2;
              if (i === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
              x += sliceWidth;
            }
            ctx.stroke();
          }
        }

        animationFrameId = requestAnimationFrame(checkVolume);
      };

      checkVolume();
    } catch (err) {
      console.warn('AudioContext analyzer failed to boot:', err);
    }

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (source) source.disconnect();
      if (audioContext && audioContext.state !== 'closed') audioContext.close();
    };
  }, [localStream, micEnabled]);

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Markup Toolbar */}
      {(role === 'agent' || role === 'supervisor') && (
        <div className="flex bg-white/5 border border-white/10 p-2 rounded-xl self-start space-x-2 select-none text-xs font-cyber font-bold items-center shrink-0">
          <span className="text-gray-500 uppercase tracking-widest text-[9px] mr-2">Screen Markup:</span>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.96 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            onClick={() => setDrawMode('none')}
            className={`px-3 py-1.5 rounded-lg transition ${drawMode === 'none' ? 'bg-purple-600 text-white animate-pulse' : 'text-gray-400 hover:text-white'}`}
          >
            Mouse Pointer
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.96 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            onClick={() => setDrawMode('highlight')}
            className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${drawMode === 'highlight' ? 'bg-purple-600 text-white animate-pulse' : 'text-gray-400 hover:text-white'}`}
          >
            <PenTool size={12} /> Highlight Area
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.96 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            onClick={() => setDrawMode('circle')}
            className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${drawMode === 'circle' ? 'bg-purple-600 text-white animate-pulse' : 'text-gray-400 hover:text-white'}`}
          >
            <Circle size={12} /> Draw Circle
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.96 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            onClick={() => setDrawMode('laser')}
            className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${drawMode === 'laser' ? 'bg-purple-600 text-white animate-pulse' : 'text-gray-400 hover:text-white'}`}
          >
            <Sparkles size={12} /> Laser Pointer
          </motion.button>
          
          {annotations.length > 0 && (
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.96 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              onClick={() => {
                setAnnotations([]);
                socket?.emit('screen-annotation', { annotation: { type: 'clear' } });
              }}
              className="text-red-400 hover:text-red-300 transition text-[10px] pl-2 border-l border-white/10"
            >
              Clear Markup
            </motion.button>
          )}
        </div>
      )}
      {/* Grid of streams */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Local Stream Card */}
        <div className={`relative bg-black rounded-2xl overflow-hidden border border-white/10 glass-panel flex flex-col justify-between transition-all duration-300 ${
          localSpeaking ? 'voice-active-ring' : ''
        }`}>
          {/* Participant name above local video tile */}
          <div className="bg-white/5 border-b border-white/10 px-4 py-2.5 text-xs font-cyber font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 tracking-wider">
            {name || 'Local Participant'} ({role})
          </div>
          {/* Video element */}
          <div className="flex-1 relative bg-[#09080e] flex items-center justify-center">
            {camEnabled && localStream ? (
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover rounded-t-2xl"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-gray-500">
                <VideoOff size={40} className="mb-2 text-purple-500/50" />
                <span className="text-xs uppercase tracking-wider font-cyber">Webcam Inactive</span>
              </div>
            )}

            {/* Quality overlay badge */}
            <div className="absolute top-3 right-3 px-2 py-1 bg-black/60 backdrop-blur border border-white/10 rounded-full flex items-center space-x-1 text-[10px] text-green-400">
              <Wifi size={10} />
              <span>HQ • Local</span>
            </div>

            {/* Bottom info banner */}
            <div className="absolute bottom-3 left-3 right-3 flex justify-between items-center bg-black/60 backdrop-blur p-2 rounded-xl border border-white/5">
              <span className="text-xs font-semibold text-gray-200">{name || 'Local Participant'} ({role})</span>
              {/* Mic state wave */}
              {micEnabled && (
                <canvas ref={localWaveformRef} width={80} height={20} className="w-16 h-5" />
              )}
            </div>
          </div>
        </div>

        {/* Remote Streams Cards */}
        {Array.from(remoteStreams.entries())
          .filter(([peerSocketId]) => peerSocketId !== socket?.id)
          .map(([peerSocketId, { stream, name: peerName, role: peerRole }]) => {
          const stats = participants.find(p => p.name === peerName) || { bitrate: 450, packetLoss: 0, latency: 15 };
          const peerVideoRef = (el: HTMLVideoElement | null) => {
            if (el && stream) {
              el.srcObject = stream;
              el.play().then(() => {
                console.log(`[Diagnostic] Video played successfully for ${peerName}`);
              }).catch(err => {
                console.warn(`[Diagnostic] Video play blocked for ${peerName}:`, err);
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('autoplay-blocked'));
                }
              });
            }
          };

          return (
            <div key={peerSocketId} className="relative bg-black rounded-2xl overflow-hidden border border-white/10 glass-panel flex flex-col justify-between transition-all duration-300">
              {/* Participant name above remote video tile */}
              <div className="bg-white/5 border-b border-white/10 px-4 py-2.5 text-xs font-cyber font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 tracking-wider">
                {peerName} ({peerRole})
              </div>
              <div className="flex-1 relative bg-[#09080e] flex items-center justify-center">
                <video
                  ref={peerVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover rounded-t-2xl"
                />

                {/* Collaborative screen annotation overlay */}
                <canvas
                  ref={overlayCanvasRef}
                  width={640}
                  height={480}
                  className="absolute inset-0 w-full h-full z-20 cursor-crosshair pointer-events-auto"
                  onMouseDown={handleOverlayMouseDown}
                  onMouseMove={handleOverlayMouseMove}
                  onMouseUp={handleOverlayMouseUp}
                />

                {/* Quality overlay badge */}
                <div className="absolute top-3 right-3 px-2.5 py-1 bg-black/60 backdrop-blur border border-white/10 rounded-full flex items-center space-x-2 text-[10px] text-gray-300">
                  <span className="flex items-center space-x-1 text-green-400">
                    <Wifi size={10} />
                    <span>{stats.latency}ms</span>
                  </span>
                  <span>|</span>
                  <span className="flex items-center space-x-1 text-purple-400">
                    <span>{stats.bitrate} kbps</span>
                  </span>
                </div>

                {/* Bottom info banner */}
                <div className="absolute bottom-3 left-3 right-3 flex justify-between items-center bg-black/60 backdrop-blur p-2 rounded-xl border border-white/5">
                  <span className="text-xs font-semibold text-gray-200">{peerName} ({peerRole})</span>
                  {stats.packetLoss > 0.05 && (
                    <span className="flex items-center gap-1 text-[10px] text-red-400 font-mono">
                      <ShieldAlert size={10} /> Loss: {(stats.packetLoss * 100).toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Empty state */}
        {Array.from(remoteStreams.entries()).filter(([peerSocketId]) => peerSocketId !== socket?.id).length === 0 && (
          <div className="relative bg-black/30 rounded-2xl border border-dashed border-white/15 flex items-center justify-center">
            <div className="text-center p-6 select-none">
              <p className="text-sm text-gray-500 font-cyber">Awaiting Participant streams...</p>
              <p className="text-xs text-gray-600 mt-1">Copy and share session link to invite guests.</p>
            </div>
          </div>
        )}
      </div>

      {/* Control Buttons Bar */}
      <div className="flex justify-between items-center p-3 bg-black/40 border border-white/10 rounded-2xl glass-panel select-none">
        <div className="flex items-center space-x-3">
          {/* Toggle Mic */}
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.96 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            onClick={toggleMic}
            className={`p-3.5 rounded-xl transition-all shadow-lg ${
              micEnabled
                ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-purple-600/10'
                : 'bg-red-950/40 border border-red-500/30 text-red-400'
            }`}
            title="Toggle Microphone"
          >
            {micEnabled ? <Mic size={18} /> : <MicOff size={18} />}
          </motion.button>

          {/* Toggle Cam */}
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.96 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            onClick={toggleCam}
            className={`p-3.5 rounded-xl transition-all shadow-lg ${
              camEnabled
                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/10'
                : 'bg-red-950/40 border border-red-500/30 text-red-400'
            }`}
            title="Toggle Camera"
          >
            {camEnabled ? <Video size={18} /> : <VideoOff size={18} />}
          </motion.button>

          {/* Toggle Screen Share */}
          {toggleScreenShare && (
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.96 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              onClick={toggleScreenShare}
              className={`p-3.5 rounded-xl transition-all shadow-lg ${
                screenSharing
                  ? 'bg-green-600 hover:bg-green-700 text-white shadow-green-600/10 animate-pulse'
                  : 'bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300'
              }`}
              title="Share Screen"
            >
              <Tv size={18} />
            </motion.button>
          )}
        </div>

        {/* Settings Filter overlays */}
        <div className="relative">
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.96 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            onClick={() => setShowFiltersMenu(!showFiltersMenu)}
            className="p-3.5 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 rounded-xl transition flex items-center gap-2 text-xs font-semibold"
          >
            <Sliders size={15} /> Audio Processing
          </motion.button>

          {showFiltersMenu && (
            <div className="absolute right-0 bottom-16 w-56 p-4 bg-gray-950 border border-white/15 rounded-2xl shadow-2xl z-30 space-y-4">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest font-cyber">Audio Controls</h4>
              <div className="space-y-3">
                <label className="flex items-center justify-between text-xs text-gray-300 cursor-pointer">
                  <span>Echo Cancellation</span>
                  <input
                    type="checkbox"
                    checked={audioConstraints.echoCancellation}
                    onChange={(e) => updateAudioConstraints('echoCancellation', e.target.checked)}
                    className="w-4 h-4 accent-purple-500 cursor-pointer"
                  />
                </label>
                <label className="flex items-center justify-between text-xs text-gray-300 cursor-pointer">
                  <span>Noise Suppression</span>
                  <input
                    type="checkbox"
                    checked={audioConstraints.noiseSuppression}
                    onChange={(e) => updateAudioConstraints('noiseSuppression', e.target.checked)}
                    className="w-4 h-4 accent-purple-500 cursor-pointer"
                  />
                </label>
                <label className="flex items-center justify-between text-xs text-gray-300 cursor-pointer">
                  <span>Auto Gain Control</span>
                  <input
                    type="checkbox"
                    checked={audioConstraints.autoGainControl}
                    onChange={(e) => updateAudioConstraints('autoGainControl', e.target.checked)}
                    className="w-4 h-4 accent-purple-500 cursor-pointer"
                  />
                </label>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default VideoGrid;
