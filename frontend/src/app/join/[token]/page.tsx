"use client";

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useStore } from '@/store/useStore';
import { motion } from 'framer-motion';
import { UserCheck } from 'lucide-react';

export default function JoinSession() {
  const params = useParams();
  const token = params.token as string;
  const router = useRouter();
  const { setSession, setAuth } = useStore();
  
  const [customerName, setCustomerName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) return;
    setLoading(true);
    setError('');

    try {
      const res = await fetch('http://localhost:5000/session/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          inviteToken: token,
          role: 'customer',
          name: customerName.trim()
        })
      });

      const data = await res.json();
      setLoading(false);

      if (res.ok) {
        setAuth('customer-token-placeholder', 'customer', data.name);
        setSession(data.sessionId);
        router.push(`/session/${data.sessionId}`);
      } else {
        setError(data.error || 'Failed to join session. Token might be invalid or expired.');
      }
    } catch (err) {
      setLoading(false);
      setError('Connection failed. Server might be offline.');
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4 grid-dots relative overflow-hidden">
      <div className="absolute inset-0 bg-[#020105] z-0" />
      <div className="absolute inset-0 bg-gradient-to-tr from-[#020105] via-transparent to-[#0a0518] opacity-90 pointer-events-none z-0" />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="z-10 max-w-md w-full p-8 border border-white/10 glass-panel rounded-3xl text-center shadow-2xl flex flex-col items-center"
      >
        <div className="w-16 h-16 rounded-full border border-purple-500/30 flex items-center justify-center mb-4 text-purple-400 animate-pulse bg-purple-950/20">
          <UserCheck size={28} />
        </div>
        <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-indigo-500 font-cyber mb-2">
          Join Support Room
        </h2>
        <p className="text-xs text-gray-500 uppercase tracking-widest font-mono mb-6">
          VisionSupport AI Secure Link
        </p>

        {error && (
          <p className="text-red-400 text-xs font-mono mb-4 text-center p-2 bg-red-950/20 border border-red-500/20 rounded-lg w-full font-cyber">
            {error}
          </p>
        )}

        <form onSubmit={handleJoin} className="w-full space-y-4">
          <div>
            <label className="text-[10px] uppercase text-gray-500 font-mono block text-left mb-1.5 ml-1">
              Enter Your Name
            </label>
            <input 
              type="text" 
              placeholder="Your name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full px-4 py-3.5 bg-black/40 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-purple-500 text-white text-center"
              required
              disabled={loading}
              autoFocus
            />
            <span className="text-[10px] text-gray-500 font-mono mt-1.5 block text-left ml-1">
              Examples: John Doe, Pratik, Sarah
            </span>
          </div>

          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.96 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            type="submit"
            disabled={loading || !customerName.trim()}
            className="w-full py-3.5 hologram-btn rounded-xl font-bold text-sm tracking-wide uppercase text-white shadow-lg shadow-purple-500/10 flex items-center justify-center gap-2 font-cyber relative overflow-hidden transition-all duration-300"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Connecting...
              </span>
            ) : (
              'Join Call'
            )}
          </motion.button>
        </form>

        <motion.button 
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.96 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          onClick={() => router.push('/')}
          className="mt-6 text-xs text-gray-500 hover:text-white transition font-mono"
        >
          ✕ Cancel & Exit
        </motion.button>
      </motion.div>
    </div>
  );
}
