"use client";

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  ShieldCheck, Calendar, Star, FileText, Download, PlayCircle, Clock, CheckCircle, Ticket as TicketIcon, Sparkles, AlertTriangle, ArrowLeft
} from 'lucide-react';
import Link from 'next/link';

interface PortalData {
  success: boolean;
  session: {
    sessionId: string;
    status: string;
    createdAt: string;
    endedAt?: string;
    csatRating?: number;
    csatFeedback?: string;
  };
  recordings: Array<{
    recordingId: string;
    status: string;
    videoUrl?: string;
    thumbnailUrl?: string;
    duration?: number;
    markers?: Array<{
      time: number;
      type: string;
      description: string;
    }>;
  }>;
  files: Array<{
    _id: string;
    filename: string;
    sizeBytes: number;
    mimeType: string;
    minioKey: string;
    uploaderName: string;
    createdAt: string;
  }>;
  tickets: Array<{
    ticketId: string;
    issueTitle: string;
    problemDescription: string;
    rootCause?: string;
    solution?: string;
    priority: string;
    status: string;
    category: string;
  }>;
}

export default function CustomerPortal() {
  const params = useParams();
  const token = params.token as string;
  const router = useRouter();
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!token) return;

    const fetchPortalData = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`http://localhost:5000/session/portal/${token}`);
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Portal link is invalid or has expired.');
        }
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        setError(err.message || 'Failed to connect to the portal server.');
      } finally {
        setLoading(false);
      }
    };

    fetchPortalData();
  }, [token]);

  const handleDownload = async (fileId: string, filename: string) => {
    try {
      const res = await fetch(`http://localhost:5000/files/download/${fileId}`);
      if (!res.ok) throw new Error('Download failed');
      const resData = await res.json();
      if (resData.downloadUrl) {
        window.open(resData.downloadUrl, '_blank');
      } else {
        alert('Could not retrieve download URL');
      }
    } catch (err) {
      console.error(err);
      alert('Error initiating file download');
    }
  };

  const jumpToTime = (seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = seconds;
      videoRef.current.play().catch(() => {});
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDuration = (sec?: number) => {
    if (!sec) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#04020a] flex items-center justify-center text-purple-400 font-cyber animate-pulse select-none">
        Decrypting Secure Portal Link...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#04020a] flex items-center justify-center p-4 select-none">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full p-8 border border-red-500/20 glass-panel rounded-3xl text-center shadow-2xl space-y-6 bg-black/60 relative overflow-hidden"
        >
          <div className="w-16 h-16 rounded-full border border-red-500/30 flex items-center justify-center mx-auto text-red-400 bg-red-950/20">
            <AlertTriangle size={28} />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-extrabold text-red-400 font-cyber">Portal Access Error</h2>
            <p className="text-xs text-gray-400 leading-relaxed font-mono">{error || 'Session link was not found.'}</p>
          </div>
          <button 
            onClick={() => router.push('/')}
            className="w-full py-3 bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-xl font-bold text-xs tracking-wider uppercase transition font-cyber"
          >
            Go Back
          </button>
        </motion.div>
      </div>
    );
  }

  const { session, recordings, files, tickets } = data;
  const activeRecording = recordings.find(r => r.status === 'ready');

  return (
    <div className="min-h-screen bg-[#04020a] text-white p-6 md:p-12 grid-dots overflow-y-auto">
      <div className="max-w-6xl mx-auto space-y-8 pb-16">
        
        {/* Top Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 border-b border-white/10 select-none">
          <div className="flex items-center space-x-3">
            <ShieldCheck className="w-8 h-8 text-green-400 drop-shadow-[0_0_8px_rgba(74,222,128,0.3)]" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-xl bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-indigo-400 font-cyber">
                  VisionSupport Secure Portal
                </h1>
                <span className="text-[9px] bg-green-500/10 border border-green-500/20 text-green-400 px-2 py-0.5 rounded-full font-mono font-bold uppercase tracking-wider">
                  Verified Tunnel
                </span>
              </div>
              <p className="text-xs text-gray-500 font-mono mt-0.5">Session Reference: {session.sessionId}</p>
            </div>
          </div>
          <Link 
            href="/"
            className="text-xs text-purple-400 hover:text-white flex items-center gap-1.5 font-cyber border border-purple-500/20 hover:border-white/20 bg-purple-950/10 px-4 py-2 rounded-xl transition duration-300"
          >
            <ArrowLeft size={12} /> Exit Portal
          </Link>
        </header>

        {/* Info Highlights Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-5 border border-white/10 glass-panel rounded-3xl bg-black/30 flex items-center gap-4">
            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-2xl text-blue-400">
              <Calendar size={20} />
            </div>
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest font-mono">Date Conducted</p>
              <p className="text-sm font-cyber font-bold mt-0.5">{new Date(session.createdAt).toLocaleDateString()} {new Date(session.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
          </div>

          <div className="p-5 border border-white/10 glass-panel rounded-3xl bg-black/30 flex items-center gap-4">
            <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-2xl text-purple-400">
              <Clock size={20} />
            </div>
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest font-mono">Status & Resolution</p>
              <p className="text-sm font-cyber font-bold mt-0.5 capitalize flex items-center gap-1.5">
                <CheckCircle size={13} className="text-green-400" /> Resolved Support Session
              </p>
            </div>
          </div>

          <div className="p-5 border border-white/10 glass-panel rounded-3xl bg-black/30 flex items-center gap-4">
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl text-yellow-400">
              <Star size={20} className="fill-yellow-400/20" />
            </div>
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest font-mono">Customer Rating Given</p>
              {session.csatRating ? (
                <div className="flex items-center gap-1 mt-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star 
                      key={i} 
                      size={12} 
                      className={i < (session.csatRating || 5) ? "text-yellow-400 fill-yellow-400" : "text-gray-600"} 
                    />
                  ))}
                  <span className="text-xs text-gray-400 font-mono ml-1">({session.csatRating}/5)</span>
                </div>
              ) : (
                <p className="text-xs text-gray-400 font-mono mt-0.5">Not rated</p>
              )}
            </div>
          </div>
        </div>

        {/* Video replay & Smart Timeline */}
        {activeRecording ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Video Player */}
            <div className="lg:col-span-2 flex flex-col gap-3">
              <div className="border border-white/10 glass-panel rounded-3xl bg-black overflow-hidden relative shadow-2xl aspect-video">
                <video 
                  ref={videoRef}
                  src={activeRecording.videoUrl || `http://localhost:5000/uploads/recordings/${activeRecording.recordingId}.webm`}
                  controls
                  className="w-full h-full object-contain"
                  poster={activeRecording.thumbnailUrl}
                />
              </div>
              <div className="flex justify-between items-center px-2 select-none">
                <span className="text-xs font-cyber font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 flex items-center gap-1.5">
                  <PlayCircle size={14} className="text-purple-400 animate-pulse" /> Call Recording Replay
                </span>
                <span className="text-xs text-gray-500 font-mono">Duration: {formatDuration(activeRecording.duration)}</span>
              </div>
            </div>

            {/* Smart Session Replay Timeline */}
            <div className="border border-white/10 glass-panel rounded-3xl p-6 bg-black/25 flex flex-col max-h-[420px] overflow-hidden">
              <h3 className="text-xs font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 uppercase tracking-widest font-cyber mb-4 flex items-center gap-1.5 shrink-0 select-none">
                <Sparkles className="w-3.5 h-3.5 text-purple-400 animate-pulse" /> Smart AI Replay Highlights
              </h3>
              
              <div className="flex-1 overflow-y-auto pr-1 space-y-4 custom-scrollbar text-xs">
                {!activeRecording.markers || activeRecording.markers.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-gray-500 italic text-center py-10 font-mono">
                    No highlights indexed for this call recording.
                  </div>
                ) : (
                  activeRecording.markers.map((marker, idx) => (
                    <div 
                      key={idx} 
                      onClick={() => jumpToTime(marker.time)}
                      className="group p-3 bg-white/5 border border-white/5 hover:border-purple-500/40 hover:bg-purple-950/10 rounded-2xl transition cursor-pointer flex gap-3.5 items-start text-left"
                    >
                      <button className="px-2 py-1 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-lg text-[10px] font-mono group-hover:bg-purple-500 group-hover:text-white transition shrink-0">
                        {formatDuration(marker.time)}
                      </button>
                      <div className="space-y-0.5">
                        <p className="font-cyber font-bold capitalize text-[11px] text-gray-200 group-hover:text-purple-300 transition">
                          {marker.type.replace('_', ' ')}
                        </p>
                        <p className="text-[10px] text-gray-500 leading-relaxed font-mono">
                          {marker.description}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="border border-white/10 glass-panel rounded-3xl p-10 bg-black/20 text-center select-none">
            <p className="text-sm text-gray-500 font-mono">No video recording is associated with this session.</p>
          </div>
        )}

        {/* Files & Ticket split */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Ticket Information Card */}
          <div className="border border-white/10 glass-panel rounded-3xl p-6 bg-black/25 flex flex-col space-y-4">
            <h3 className="text-xs font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 uppercase tracking-widest font-cyber flex items-center gap-1.5 select-none">
              <TicketIcon className="w-3.5 h-3.5 text-purple-400" /> Associated Ticket Details
            </h3>

            <div className="flex-1 space-y-4">
              {tickets.length === 0 ? (
                <div className="h-full flex items-center justify-center text-gray-500 italic text-center py-10 font-mono">
                  No tickets linked to this session.
                </div>
              ) : (
                tickets.map((t) => (
                  <div key={t.ticketId} className="space-y-4">
                    <div className="bg-white/5 p-4 border border-white/5 rounded-2xl space-y-3">
                      <div className="flex justify-between items-center border-b border-white/10 pb-2.5">
                        <div>
                          <p className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">{t.ticketId}</p>
                          <h4 className="text-sm font-cyber font-bold mt-0.5">{t.issueTitle}</h4>
                        </div>
                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider ${
                          t.status === 'Resolved' || t.status === 'Closed' 
                            ? 'bg-green-500/10 border border-green-500/20 text-green-400'
                            : 'bg-yellow-500/10 border border-yellow-500/20 text-yellow-400'
                        }`}>
                          {t.status}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3 text-[10px] font-mono text-gray-400">
                        <div>Priority: <span className="text-white font-bold">{t.priority}</span></div>
                        <div>Category: <span className="text-white font-bold">{t.category}</span></div>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[9px] text-gray-500 uppercase tracking-wider font-mono">Problem Description</span>
                        <p className="text-[10px] text-gray-300 leading-relaxed font-sans">{t.problemDescription}</p>
                      </div>

                      {t.solution && (
                        <div className="space-y-1 p-3 bg-purple-950/20 border border-purple-500/20 rounded-xl">
                          <span className="text-[9px] text-purple-400 uppercase tracking-wider font-mono font-bold flex items-center gap-1">
                            <Sparkles size={10} className="animate-pulse" /> Verified AI Solution
                          </span>
                          <p className="text-[10px] text-purple-200 leading-relaxed font-sans">{t.solution}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Shared Files list */}
          <div className="border border-white/10 glass-panel rounded-3xl p-6 bg-black/25 flex flex-col space-y-4">
            <h3 className="text-xs font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 uppercase tracking-widest font-cyber flex items-center gap-1.5 select-none">
              <FileText className="w-3.5 h-3.5 text-purple-400" /> Repository Files ({files.length})
            </h3>
            
            <div className="flex-1 space-y-3 overflow-y-auto max-h-[300px] pr-1 custom-scrollbar">
              {files.length === 0 ? (
                <div className="h-full flex items-center justify-center text-gray-500 italic text-center py-12 font-mono">
                  No files shared during this session.
                </div>
              ) : (
                files.map((file) => (
                  <div key={file._id} className="p-3 bg-white/5 border border-white/5 hover:border-white/10 rounded-2xl flex items-center justify-between gap-3 group transition">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="p-2.5 bg-white/5 border border-white/10 rounded-xl text-gray-400 shrink-0">
                        <FileText size={16} />
                      </div>
                      <div className="overflow-hidden">
                        <p className="text-xs font-bold text-gray-200 truncate group-hover:text-purple-400 transition">{file.filename}</p>
                        <p className="text-[9px] text-gray-500 font-mono mt-0.5">
                          {formatSize(file.sizeBytes)} • {file.uploaderName}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDownload(file._id, file.filename)}
                      className="p-2 bg-purple-500/10 border border-purple-500/20 text-purple-400 hover:bg-purple-600 hover:text-white rounded-xl transition duration-300 shrink-0"
                      title="Download File"
                    >
                      <Download size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
