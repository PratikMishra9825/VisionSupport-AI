"use client";

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Canvas, useFrame } from '@react-three/fiber';
import { motion, AnimatePresence } from 'framer-motion';
import * as THREE from 'three';
import ThreeBackground from '@/components/ThreeBackground';
import { 
  Video, FileText, Share2, Monitor, PlayCircle, Edit3, LineChart, 
  ArrowRight, ShieldCheck, HelpCircle, Sparkles, Terminal, Globe, UserCheck
} from 'lucide-react';

// Animated Counter component utilizing timer progressions
function Counter({ target, duration = 2.5, decimals = 0, suffix = "" }: { 
  target: number; 
  duration?: number; 
  decimals?: number; 
  suffix?: string; 
}) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const startTime = Date.now();
    const timer = setInterval(() => {
      const timePassed = (Date.now() - startTime) / 1000;
      const progress = Math.min(timePassed / duration, 1);
      setCount(progress * target);
      if (progress === 1) {
        clearInterval(timer);
      }
    }, 30);
    return () => clearInterval(timer);
  }, [target, duration]);

  return <span>{count.toFixed(decimals)}{suffix}</span>;
}

// 3D Nested Mesh Logo for the Hero Section
function RotatingHeroMesh() {
  const outerRef = useRef<THREE.Mesh>(null);
  const innerRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((state) => {
    const elapsed = state.clock.getElapsedTime();
    if (outerRef.current) {
      outerRef.current.rotation.y = elapsed * 0.45;
      outerRef.current.rotation.x = elapsed * 0.2;
      outerRef.current.position.y = Math.sin(elapsed) * 0.12;
    }
    if (innerRef.current) {
      innerRef.current.rotation.y = -elapsed * 0.9;
      innerRef.current.rotation.z = elapsed * 0.45;
    }
  });

  return (
    <group onPointerOver={() => setHovered(true)} onPointerOut={() => setHovered(false)}>
      {/* Outer spinning shell */}
      <mesh ref={outerRef} scale={hovered ? 1.9 : 1.7}>
        <icosahedronGeometry args={[1, 1]} />
        <meshBasicMaterial
          color={hovered ? '#c084fc' : '#3b82f6'}
          wireframe={true}
          transparent={true}
          opacity={0.5}
        />
      </mesh>
      {/* Inner solid-looking wireframe core */}
      <mesh ref={innerRef} scale={hovered ? 0.95 : 0.85}>
        <octahedronGeometry args={[1, 0]} />
        <meshBasicMaterial
          color={hovered ? '#ec4899' : '#8b5cf6'}
          wireframe={true}
          transparent={true}
          opacity={0.8}
        />
      </mesh>
    </group>
  );
}

function LandingLogo3D() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <div className="w-64 h-64 mx-auto rounded-full border border-purple-500/20 animate-pulse" />;

  return (
    <div className="w-80 h-80 mx-auto select-none cursor-pointer">
      <Canvas camera={{ position: [0, 0, 3.5], fov: 50 }}>
        <ambientLight intensity={1.2} />
        <pointLight position={[10, 10, 10]} />
        <RotatingHeroMesh />
      </Canvas>
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinInput, setJoinInput] = useState('');
  const [modalError, setModalError] = useState('');
  const featuresRef = useRef<HTMLDivElement>(null);

  // Parsing support URLs to navigate directly
  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setModalError('');
    const input = joinInput.trim();
    if (!input) return;

    try {
      // Case 1: Full session link with query parameter, e.g. /session/abc?token=xyz
      if (input.includes('/session/')) {
        const urlObj = new URL(input.startsWith('http') ? input : `http://${input}`);
        const pathParts = urlObj.pathname.split('/');
        const id = pathParts[pathParts.indexOf('session') + 1];
        const token = urlObj.searchParams.get('token');
        if (id && token) {
          router.push(`/session/${id}?token=${token}`);
          return;
        }
      }

      // Case 2: Full join token link, e.g. http://localhost:3000/join/xyz
      if (input.includes('/join/')) {
        const token = input.substring(input.lastIndexOf('/join/') + 6);
        router.push(`/join/${token}`);
        return;
      }

      // Case 3: Raw token inputted, we redirect to the join handler directly
      router.push(`/join/${input}`);
    } catch (err) {
      setModalError('Invalid link format. Enter a valid token or paste invite URL.');
    }
  };

  const scrollToFeatures = () => {
    featuresRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#04020a] text-white overflow-x-hidden relative font-sans">
      {/* 3D Particle Field background */}
      <ThreeBackground />

      {/* Futuristic Floating Header */}
      <header className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-5 flex justify-between items-center select-none w-full">
        <div className="flex items-center space-x-2 sm:space-x-3">
          <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400 animate-pulse" />
          <h1 className="font-extrabold text-sm sm:text-xl bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400 font-cyber uppercase tracking-wider">
            VisionSupport AI
          </h1>
        </div>
        <nav className="hidden md:flex items-center space-x-8 text-xs font-cyber font-bold tracking-widest text-gray-400">
          <a onClick={scrollToFeatures} className="hover:text-white transition cursor-pointer">FEATURES</a>
          <a href="#demo" className="hover:text-white transition">LIVE DEMO</a>
          <a href="#stats" className="hover:text-white transition">TELEMETRY</a>
        </nav>
        <div className="flex items-center gap-1.5 sm:gap-3">
          <button 
            onClick={() => router.push('/login')} 
            className="px-3 sm:px-5 py-2 sm:py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[10px] sm:text-xs font-cyber font-bold tracking-widest text-gray-200 transition"
          >
            <span className="hidden sm:inline">AGENT </span>LOGIN
          </button>
          <button 
            onClick={() => setShowJoinModal(true)} 
            className="px-3 sm:px-5 py-2 sm:py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 rounded-xl text-[10px] sm:text-xs font-cyber font-bold tracking-widest text-white transition shadow-lg shadow-purple-500/10 hover:shadow-purple-500/20"
          >
            JOIN<span className="hidden sm:inline"> SESSION</span>
          </button>
        </div>
      </header>

      {/* 1. Hero Section */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 pt-12 pb-20 grid grid-cols-1 lg:grid-cols-2 items-center gap-12">
        <motion.div 
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="space-y-6 text-left"
        >
          <span className="inline-flex items-center gap-2 px-3 py-1 bg-purple-500/10 border border-purple-500/30 rounded-full text-[10px] uppercase tracking-widest text-purple-400 font-mono font-bold animate-pulse">
            <ShieldCheck size={11} /> Enterprise Security Protocols Active
          </span>
          <h2 className="text-5xl lg:text-6xl font-black font-cyber leading-tight tracking-wide">
            See the Solution, <br/>
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-pink-500">
              Not Just Hear It.
            </span>
          </h2>
          <p className="text-gray-400 text-sm md:text-base max-w-xl leading-relaxed">
            VisionSupport AI merges containerized WebRTC SFU real-time video, collaborative canvas whiteboard, 
            AES-256 client-side encrypted S3 uploads, and advanced Gemini AI diagnostics into a futuristic, 
            3D WebGL interface. Built for high-frequency support clusters.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-4 select-none">
            <button 
              onClick={() => setShowJoinModal(true)} 
              className="px-6 py-3.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl text-sm font-bold tracking-wider uppercase transition shadow-lg hover:shadow-purple-500/25 flex items-center gap-2"
            >
              Join Session <ArrowRight size={16} />
            </button>
            <button 
              onClick={scrollToFeatures} 
              className="px-6 py-3.5 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 rounded-xl text-sm font-bold tracking-wider uppercase transition"
            >
              Learn More
            </button>
          </div>
        </motion.div>

        {/* 3D Rotating Logo Box */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="relative flex justify-center items-center select-none"
        >
          <div className="absolute w-72 h-72 bg-purple-500/10 blur-[100px] rounded-full pointer-events-none" />
          <LandingLogo3D />

          {/* Holographic floating cards */}
          <div className="absolute top-10 left-10 p-3 bg-white/5 border border-white/10 rounded-xl glass-panel text-left hidden sm:block animate-bounce shadow-xl">
            <p className="text-[10px] text-gray-500 font-mono">LATENCY</p>
            <p className="text-xs font-bold text-green-400 font-cyber">14ms OTLP</p>
          </div>
          <div className="absolute bottom-10 right-10 p-3 bg-white/5 border border-white/10 rounded-xl glass-panel text-left hidden sm:block animate-pulse shadow-xl">
            <p className="text-[10px] text-gray-500 font-mono">SECURITY</p>
            <p className="text-xs font-bold text-purple-400 font-cyber">AES-256-GCM</p>
          </div>
        </motion.div>
      </section>

      {/* 2. Features Grid Section */}
      <section ref={featuresRef} className="relative z-10 max-w-7xl mx-auto px-6 py-20 border-t border-white/5">
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <p className="text-purple-400 text-xs font-mono tracking-widest uppercase font-bold">Comprehensive Capabilities</p>
          <h2 className="text-3xl lg:text-4xl font-extrabold font-cyber">Holographic Support Engine</h2>
          <p className="text-gray-400 text-sm leading-relaxed">
            Every support channel is fully optimized for containerization, zero-dependency local fallbacks, 
            and complete real-time client state synchronization.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 select-none">
          <div className="p-6 bg-white/5 border border-white/10 rounded-2xl glass-panel glass-panel-hover flex flex-col justify-between">
            <div className="p-3 bg-blue-600/10 border border-blue-500/30 text-blue-400 rounded-xl w-fit mb-4">
              <Video size={20} />
            </div>
            <div>
              <h3 className="font-cyber font-bold text-gray-200 mb-2">Real-Time Video</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                MediaSoup WebRTC SFU integration providing high-bitrate, multi-cast stream grids with dynamic resolution.
              </p>
            </div>
          </div>

          <div className="p-6 bg-white/5 border border-white/10 rounded-2xl glass-panel glass-panel-hover flex flex-col justify-between">
            <div className="p-3 bg-purple-600/10 border border-purple-500/30 text-purple-400 rounded-xl w-fit mb-4">
              <FileText size={20} />
            </div>
            <div>
              <h3 className="font-cyber font-bold text-gray-200 mb-2">AI Summary</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Gemini AI endpoint generation compiling meeting transcriptions, key actions, and sentiment reviews automatically.
              </p>
            </div>
          </div>

          <div className="p-6 bg-white/5 border border-white/10 rounded-2xl glass-panel glass-panel-hover flex flex-col justify-between">
            <div className="p-3 bg-pink-600/10 border border-pink-500/30 text-pink-400 rounded-xl w-fit mb-4">
              <Share2 size={20} />
            </div>
            <div>
              <h3 className="font-cyber font-bold text-gray-200 mb-2">File Sharing</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Resumable chunked file upload engine with client-side AES encryption at rest directly to S3 storage.
              </p>
            </div>
          </div>

          <div className="p-6 bg-white/5 border border-white/10 rounded-2xl glass-panel glass-panel-hover flex flex-col justify-between">
            <div className="p-3 bg-green-600/10 border border-green-500/30 text-green-400 rounded-xl w-fit mb-4">
              <Monitor size={20} />
            </div>
            <div>
              <h3 className="font-cyber font-bold text-gray-200 mb-2">Screen Sharing</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                High-performance viewport sharing for supervisors and customers with synchronized view boxes.
              </p>
            </div>
          </div>

          <div className="p-6 bg-white/5 border border-white/10 rounded-2xl glass-panel glass-panel-hover flex flex-col justify-between">
            <div className="p-3 bg-yellow-600/10 border border-yellow-500/30 text-yellow-400 rounded-xl w-fit mb-4">
              <PlayCircle size={20} />
            </div>
            <div>
              <h3 className="font-cyber font-bold text-gray-200 mb-2">Recording</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Static FFmpeg recording server combining video and audio elements on-the-fly with timeline marker indexing.
              </p>
            </div>
          </div>

          <div className="p-6 bg-white/5 border border-white/10 rounded-2xl glass-panel glass-panel-hover flex flex-col justify-between">
            <div className="p-3 bg-indigo-600/10 border border-indigo-500/30 text-indigo-400 rounded-xl w-fit mb-4">
              <Edit3 size={20} />
            </div>
            <div>
              <h3 className="font-cyber font-bold text-gray-200 mb-2">Collaborative Whiteboard</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Real-time canvas drawing with shapes, stickies, and synchronized cursor tracking powered by Socket.IO.
              </p>
            </div>
          </div>

          <div className="p-6 bg-white/5 border border-white/10 rounded-2xl glass-panel glass-panel-hover flex flex-col justify-between">
            <div className="p-3 bg-blue-600/10 border border-blue-500/30 text-blue-400 rounded-xl w-fit mb-4">
              <LineChart size={20} />
            </div>
            <div>
              <h3 className="font-cyber font-bold text-gray-200 mb-2">Live Analytics</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                System telemetry dashboard tracking bandwidth, jitter, packet loss, and CPU load profiles dynamically.
              </p>
            </div>
          </div>

          <div className="p-6 bg-purple-600/10 border border-purple-500/30 rounded-2xl glass-panel flex flex-col justify-center items-center text-center">
            <Terminal className="w-8 h-8 text-purple-400 mb-3 animate-pulse" />
            <h3 className="font-cyber font-bold text-gray-200 mb-1 text-sm">Need Access?</h3>
            <p className="text-[10px] text-gray-400 max-w-[150px] mb-3">Join a secure support channel directly via invite token.</p>
            <button onClick={() => setShowJoinModal(true)} className="px-3.5 py-1.5 bg-purple-600 text-white rounded-lg text-[10px] font-bold tracking-widest uppercase hover:bg-purple-700 transition">
              JOIN PORTAL
            </button>
          </div>
        </div>
      </section>

      {/* 3. Demo Section: Simulated Active Diagnostic Session */}
      <section id="demo" className="relative z-10 max-w-7xl mx-auto px-6 py-20 border-t border-white/5">
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <p className="text-blue-400 text-xs font-mono tracking-widest uppercase font-bold">Interactive Sandbox Preview</p>
          <h2 className="text-3xl lg:text-4xl font-extrabold font-cyber">Live Session Diagnostic Feed</h2>
          <p className="text-gray-400 text-sm leading-relaxed">
            Experience the automated workflow layout representing real-time synchronization between Agent, Whiteboard, and Telemetry systems.
          </p>
        </div>

        {/* Mock Call Panel Workspace */}
        <div className="max-w-5xl mx-auto p-4 bg-black/60 border border-white/10 rounded-3xl glass-panel shadow-2xl space-y-4">
          <div className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs font-cyber tracking-widest font-bold uppercase">Feed: VS-1092-ACTIVE</span>
            </div>
            <div className="flex items-center space-x-3 text-[10px] text-purple-400 font-mono font-bold">
              <span>VOIP: ACTIVE</span>
              <span>•</span>
              <span>SFU CHANNELS: 2</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Streams Panel */}
            <div className="col-span-2 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="relative aspect-video rounded-2xl bg-gradient-to-tr from-purple-950/20 to-blue-950/20 border border-white/5 flex flex-col justify-between p-3 overflow-hidden">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center font-bold font-cyber text-blue-300">A</div>
                  </div>
                  <span className="z-10 px-2 py-0.5 bg-black/60 border border-blue-500/30 rounded text-[9px] font-mono text-blue-300 w-fit">AGENT: LEAD SUPPORT</span>
                  <div className="z-10 flex space-x-1 items-end w-fit">
                    <span className="w-1 h-3 bg-blue-400 rounded-full animate-bounce" />
                    <span className="w-1 h-4 bg-blue-400 rounded-full animate-bounce delay-100" />
                    <span className="w-1 h-2.5 bg-blue-400 rounded-full animate-bounce delay-200" />
                  </div>
                </div>

                <div className="relative aspect-video rounded-2xl bg-gradient-to-tr from-purple-950/20 to-blue-950/20 border border-white/5 flex flex-col justify-between p-3 overflow-hidden">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-purple-600/20 border border-purple-500/30 flex items-center justify-center font-bold font-cyber text-purple-300">C</div>
                  </div>
                  <span className="z-10 px-2 py-0.5 bg-black/60 border border-purple-500/30 rounded text-[9px] font-mono text-purple-300 w-fit">CUSTOMER: GUEST #92</span>
                  <div className="z-10 flex space-x-1 items-end w-fit">
                    <span className="w-1 h-2 bg-purple-400 rounded-full animate-bounce" />
                    <span className="w-1 h-3 bg-purple-400 rounded-full animate-bounce delay-100" />
                    <span className="w-1 h-1 bg-purple-400 rounded-full animate-bounce delay-200" />
                  </div>
                </div>
              </div>

              {/* Whiteboard Simulation */}
              <div className="relative h-44 rounded-2xl bg-black/50 border border-white/5 p-4 flex flex-col justify-between overflow-hidden">
                <span className="text-[10px] font-mono text-gray-500 tracking-wider">COLLABORATIVE WHITEBOARD SIMULATION</span>
                
                {/* Simulated shapes and drawing lines */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <svg className="w-full h-full p-6">
                    <motion.circle 
                      cx="50%" cy="50%" r="35" 
                      stroke="#8b5cf6" strokeWidth="2" fill="none" strokeDasharray="100"
                      initial={{ strokeDashoffset: 100 }}
                      animate={{ strokeDashoffset: 0 }}
                      transition={{ duration: 3, repeat: Infinity, repeatType: "reverse" }}
                    />
                    <motion.line 
                      x1="20%" y1="70%" x2="40%" y2="30%" 
                      stroke="#3b82f6" strokeWidth="2"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 2, repeat: Infinity, repeatType: "reverse" }}
                    />
                    {/* Simulated cursor */}
                    <motion.polygon 
                      points="0,0 10,12 3,12" 
                      fill="#ec4899"
                      animate={{ x: [100, 200, 150, 100], y: [50, 100, 80, 50] }}
                      transition={{ duration: 6, repeat: Infinity }}
                    />
                  </svg>
                </div>
                <div className="flex justify-between text-[10px] text-purple-400 font-mono z-10">
                  <span>Whiteboard: Synced</span>
                  <span>Active Cursor: Guest #92</span>
                </div>
              </div>
            </div>

            {/* Sidebar Feed */}
            <div className="col-span-1 space-y-4 flex flex-col h-full">
              {/* Chat & Auto Transcription Feed */}
              <div className="flex-1 bg-black/50 border border-white/5 rounded-2xl p-4 flex flex-col justify-between h-44 overflow-hidden">
                <span className="text-[10px] font-mono text-gray-500 block mb-2">LIVE SUBTITLES TRANSLATOR</span>
                <div className="space-y-2 flex-1 text-[11px] font-sans flex flex-col justify-end">
                  <p className="text-gray-400"><span className="text-purple-400 font-bold">Cust:</span> Booting error code 4... [English]</p>
                  <p className="text-gray-400"><span className="text-blue-400 font-bold">Agent:</span> Let me check coordinates... [English]</p>
                  <motion.p 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0, 1, 1, 0] }}
                    transition={{ duration: 4, repeat: Infinity }}
                    className="text-purple-300 font-medium italic"
                  >
                    Translation: "Permítame revisar..." [Spanish]
                  </motion.p>
                </div>
              </div>

              {/* Live telemetry signal graph */}
              <div className="bg-black/50 border border-white/5 rounded-2xl p-4 h-32 flex flex-col justify-between">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-mono text-gray-500">SIGNAL BITRATE STREAM</span>
                  <span className="text-[10px] font-mono text-green-400 font-bold">1420kb/s</span>
                </div>
                <div className="w-full h-12">
                  <svg viewBox="0 0 100 20" className="w-full h-full">
                    <path 
                      d="M0 10 Q10 2, 20 12 T40 5 T60 15 T80 4 T100 10" 
                      fill="none" stroke="#3b82f6" strokeWidth="1.5" 
                      className="animate-pulse"
                    />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Statistics Counters Section */}
      <section id="stats" className="relative z-10 max-w-7xl mx-auto px-6 py-20 border-t border-white/5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center select-none">
          <div className="p-8 bg-white/5 border border-white/10 rounded-3xl glass-panel relative">
            <h4 className="text-gray-500 text-xs font-mono uppercase tracking-widest mb-2">Active Sessions</h4>
            <div className="text-5xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400 font-cyber">
              <Counter target={1420} decimals={0} suffix="+" />
            </div>
            <p className="text-xs text-gray-400 mt-2 font-mono">Simultaneous global transmissions</p>
          </div>

          <div className="p-8 bg-white/5 border border-white/10 rounded-3xl glass-panel relative">
            <h4 className="text-gray-500 text-xs font-mono uppercase tracking-widest mb-2">Avg Resolution Time</h4>
            <div className="text-5xl font-black bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-500 font-cyber">
              <Counter target={4.8} decimals={1} suffix="m" />
            </div>
            <p className="text-xs text-gray-400 mt-2 font-mono">End-to-end call termination log</p>
          </div>

          <div className="p-8 bg-white/5 border border-white/10 rounded-3xl glass-panel relative">
            <h4 className="text-gray-500 text-xs font-mono uppercase tracking-widest mb-2">Customer SAT Score</h4>
            <div className="text-5xl font-black bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-emerald-400 font-cyber">
              <Counter target={99.4} decimals={1} suffix="%" />
            </div>
            <p className="text-xs text-gray-400 mt-2 font-mono">CSAT post-call survey rating</p>
          </div>
        </div>
      </section>

      {/* 5. Join Session Modal Dialog */}
      <AnimatePresence>
        {showJoinModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-gray-950 border border-white/10 p-8 rounded-3xl max-w-md w-full relative glass-panel shadow-2xl flex flex-col items-center select-none"
            >
              <button 
                onClick={() => { setShowJoinModal(false); setModalError(''); setJoinInput(''); }} 
                className="absolute right-4 top-4 text-gray-500 hover:text-white transition font-mono font-bold text-xs"
              >
                ✕
              </button>

              <div className="w-12 h-12 rounded-full border border-purple-500/20 bg-purple-950/20 flex items-center justify-center text-purple-400 mb-4 animate-pulse">
                <UserCheck size={22} />
              </div>

              <h3 className="text-2xl font-bold font-cyber text-purple-400 mb-2 text-center">Connect support portal</h3>
              <p className="text-xs text-gray-400 text-center mb-6 leading-relaxed">
                Paste your secure invite link or enter the 36-character token to establish WebRTC connection tunnels.
              </p>

              {modalError && (
                <p className="text-red-400 text-xs font-mono text-center mb-4 p-2 bg-red-950/25 border border-red-500/35 rounded-lg w-full">
                  {modalError}
                </p>
              )}

              <form onSubmit={handleJoinSubmit} className="w-full space-y-4">
                <input 
                  type="text" 
                  placeholder="Invite URL or token code"
                  value={joinInput}
                  onChange={(e) => setJoinInput(e.target.value)}
                  className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                  required
                />
                <button
                  type="submit"
                  className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 rounded-xl font-bold text-xs tracking-wider uppercase text-white shadow-lg shadow-purple-500/20 transition flex items-center justify-center gap-2"
                >
                  Join Room <ArrowRight size={14} />
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 6. Footer Section */}
      <footer className="relative z-10 border-t border-white/5 bg-black/40 select-none">
        <div className="max-w-7xl mx-auto px-6 py-12 flex flex-col md:flex-row justify-between items-center gap-6 text-xs text-gray-500 font-mono">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-purple-500" />
            <span className="font-bold text-gray-400 font-cyber">VISIONSUPPORT AI</span>
          </div>

          <div className="flex flex-wrap justify-center gap-6">
            <a href="#" className="hover:text-white transition">About</a>
            <a onClick={scrollToFeatures} className="hover:text-white transition cursor-pointer">Features</a>
            <a href="#" className="hover:text-white transition">Contact</a>
            <a href="#" className="hover:text-white transition">GitHub</a>
            <a href="#" className="hover:text-white transition">Documentation</a>
          </div>

          <p>© 2026 VisionSupport AI. All telemetry tunnels encrypted.</p>
        </div>
      </footer>
    </div>
  );
}
