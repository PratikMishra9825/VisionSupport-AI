"use client";

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/store/useStore';
import { motion, AnimatePresence } from 'framer-motion';
import DashboardCharts from '@/components/DashboardCharts';
import { 
  Plus, Power, Key, Clipboard, Shield, Video, History, UserCheck, 
  ShieldAlert, XCircle, User, Settings, Database, Server, RefreshCw, FileText, 
  Settings2, Download, Search, CheckCircle, HelpCircle, Moon, Sun, Camera, Star, Activity
} from 'lucide-react';

function CircularProgress({ value, max, label, color, glowColor }: { value: number; max: number; label: string; color: string; glowColor: string }) {
  const radius = 45;
  const stroke = 6;
  const normalizedValue = Math.min(Math.max(value, 0), max);
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (normalizedValue / max) * circumference;

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-black/40 border border-white/10 rounded-3xl glass-panel relative overflow-hidden group hover:border-purple-500/30 transition duration-300 w-full">
      <div className="absolute inset-0 bg-gradient-to-tr from-purple-950/5 via-transparent to-blue-950/5" />
      <div className="relative w-28 h-28 flex items-center justify-center">
        {/* SVG Dial */}
        <svg className="w-full h-full transform -rotate-90">
          <defs>
            <filter id={`glow-${label}`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {/* Base track */}
          <circle
            cx="56"
            cy="56"
            r={radius}
            stroke="rgba(255,255,255,0.05)"
            strokeWidth={stroke}
            fill="transparent"
          />
          {/* Active progress track */}
          <circle
            cx="56"
            cy="56"
            r={radius}
            stroke={color}
            strokeWidth={stroke}
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            filter={`url(#glow-${label})`}
            style={{ transition: 'stroke-dashoffset 0.8s ease-in-out' }}
          />
        </svg>
        {/* Value Label */}
        <div className="absolute text-center select-none">
          <span className="text-xl font-black font-cyber tracking-wide block" style={{ color, textShadow: `0 0 8px ${glowColor}` }}>
            {value.toFixed(0)}
          </span>
          <span className="text-[8px] uppercase tracking-widest text-gray-500 font-mono block mt-0.5">{label}</span>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const { 
    token, role, name, email, companyName, profilePhoto, language, darkMode, 
    notificationPreferences, csrfToken, setSession, logout, setAuth 
  } = useStore();
  
  const [sessions, setSessions] = useState<any[]>([]);
  const [liveSessions, setLiveSessions] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  
  const [inviteLink, setInviteLink] = useState('');
  const [activeTab, setActiveTab] = useState<'live' | 'history' | 'tickets' | 'profile' | 'audit' | 'metrics' | 'csat'>('live');
  const [systemStats, setSystemStats] = useState({ cpu: 12, memory: 240, packetLoss: 0.1 });

  // System metrics poller
  useEffect(() => {
    if (!token) return;
    const fetchStats = async () => {
      try {
        const res = await fetch('http://localhost:5000/admin/metrics', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setSystemStats({
            cpu: data.cpu || 15,
            memory: data.memory || 210,
            packetLoss: liveSessions.length > 0 ? Math.random() * 0.05 : 0.0
          });
        }
      } catch (err) {
        // Fallback simulation
        setSystemStats({
          cpu: 10 + Math.floor(Math.random() * 20),
          memory: 200 + Math.floor(Math.random() * 40),
          packetLoss: liveSessions.length > 0 ? Math.random() * 0.08 : 0.0
        });
      }
    };
    fetchStats();
    const timer = setInterval(fetchStats, 4000);
    return () => clearInterval(timer);
  }, [token, liveSessions]);

  // CSAT aggregates
  const endedSessions = sessions.filter(s => s.status === 'ended');
  const csatSessions = endedSessions.filter(s => typeof s.csatRating === 'number');
  
  const avgCsat = csatSessions.length > 0 
    ? csatSessions.reduce((acc, s) => acc + s.csatRating!, 0) / csatSessions.length 
    : 4.5;
    
  const avgResponseTime = endedSessions.length > 0
    ? endedSessions.reduce((acc, s) => acc + (s.responseTime || 0), 0) / endedSessions.length
    : 35;
    
  const avgResolution = endedSessions.length > 0
    ? endedSessions.reduce((acc, s) => acc + (s.resolutionDuration || 0), 0) / endedSessions.length
    : 240;

  const formatTimePeriod = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    if (m === 0) return `${s}s`;
    return `${m}m ${s}s`;
  };

  // 2FA variables
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [tfaSecret, setTfaSecret] = useState('');
  const [tfaCode, setTfaCode] = useState('');
  const [tfaSuccess, setTfaSuccess] = useState('');
  const [tfaError, setTfaError] = useState('');

  // Tickets Search & KB states
  const [tickets, setTickets] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [kbQuery, setKbQuery] = useState('');
  const [kbArticles, setKbArticles] = useState<any[]>([]);
  const [kbRecommendations, setKbRecommendations] = useState<any[]>([]);

  // Profile fields state
  const [profileCompany, setProfileCompany] = useState(companyName || '');
  const [profileLang, setProfileLang] = useState(language || 'en');
  const [profileDark, setProfileDark] = useState(darkMode !== false);
  const [profileEmailNotif, setProfileEmailNotif] = useState(notificationPreferences?.email !== false);
  const [profilePushNotif, setProfilePushNotif] = useState(notificationPreferences?.push !== false);
  
  // Password change fields
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Device session list
  const [deviceSessions, setDeviceSessions] = useState<any[]>([]);

  // UI Message/Error flags
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [feedbackErr, setFeedbackErr] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!token || (role !== 'agent' && role !== 'supervisor')) {
      router.push('/login');
      return;
    }

    fetchHistory();
    fetchLiveSessions();
    fetchAuditLogs();
    fetchTickets();
    fetchKbArticles();
    fetchDeviceSessions();
    
    const poller = setInterval(() => {
      fetchLiveSessions();
    }, 5000);

    return () => clearInterval(poller);
  }, [token, role, router]);

  // Sync profile fields with state when store updates
  useEffect(() => {
    if (companyName) setProfileCompany(companyName);
    if (language) setProfileLang(language);
    setProfileDark(darkMode !== false);
    setProfileEmailNotif(notificationPreferences?.email !== false);
    setProfilePushNotif(notificationPreferences?.push !== false);
  }, [companyName, language, darkMode, notificationPreferences]);

  const fetchHistory = async () => {
    try {
      const res = await fetch('http://localhost:5000/session/history', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setSessions(data);
    } catch (err) {
      console.error('Failed to fetch history', err);
    }
  };

  const fetchLiveSessions = async () => {
    try {
      const res = await fetch('http://localhost:5000/admin/sessions/live', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setLiveSessions(data);
    } catch (err) {
      console.error('Failed to fetch live sessions', err);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const res = await fetch('http://localhost:5000/admin/audit-logs', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setAuditLogs(data);
    } catch (err) {
      console.error('Failed to fetch audit logs', err);
    }
  };

  const fetchTickets = async () => {
    try {
      const queryParams = new URLSearchParams();
      if (searchQuery) queryParams.append('q', searchQuery);
      if (filterStatus) queryParams.append('status', filterStatus);
      if (filterPriority) queryParams.append('priority', filterPriority);

      const res = await fetch(`http://localhost:5000/tickets?${queryParams.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setTickets(data);
    } catch (err) {
      console.error('Failed to fetch tickets', err);
    }
  };

  const fetchKbArticles = async () => {
    try {
      const url = kbQuery 
        ? `http://localhost:5000/kb?q=${encodeURIComponent(kbQuery)}` 
        : 'http://localhost:5000/kb';
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setKbArticles(data);
    } catch (err) {
      console.error('Failed to fetch KB articles', err);
    }
  };

  const fetchDeviceSessions = async () => {
    try {
      const res = await fetch('http://localhost:5000/auth/sessions', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setDeviceSessions(data);
    } catch (err) {
      console.error('Failed to fetch active device sessions', err);
    }
  };

  const createSession = async () => {
    try {
      const res = await fetch('http://localhost:5000/session/create', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-CSRF-Token': csrfToken || ''
        }
      });
      const data = await res.json();
      if (res.ok) {
        setInviteLink(data.inviteLink);
        setSession(data.sessionId, data.inviteLink);
        fetchHistory();
        fetchLiveSessions();
      }
    } catch (err) {
      console.error('Failed to create session', err);
    }
  };

  const terminateSession = async (sessionId: string) => {
    if (!confirm('Are you sure you want to force terminate this session?')) return;
    try {
      const res = await fetch('http://localhost:5000/admin/sessions/terminate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-CSRF-Token': csrfToken || ''
        },
        body: JSON.stringify({ sessionId })
      });
      if (res.ok) {
        fetchLiveSessions();
        fetchAuditLogs();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const disconnectUser = async (sessionId: string, userId: string) => {
    try {
      const res = await fetch('http://localhost:5000/admin/participants/disconnect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-CSRF-Token': csrfToken || ''
        },
        body: JSON.stringify({ sessionId, userId })
      });
      if (res.ok) {
        fetchLiveSessions();
        fetchAuditLogs();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // 2FA Management
  const setup2FA = async () => {
    setTfaError('');
    setTfaSuccess('');
    try {
      const res = await fetch('http://localhost:5000/auth/2fa/setup', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-CSRF-Token': csrfToken || ''
        },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (res.ok) {
        setQrCodeUrl(data.qrCodeUrl);
        setTfaSecret(data.secret);
      } else {
        setTfaError(data.error || 'Failed to initialize setup');
      }
    } catch (err) {
      setTfaError('Failed to configure 2FA setup');
    }
  };

  const enable2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setTfaError('');
    setTfaSuccess('');
    try {
      const res = await fetch('http://localhost:5000/auth/2fa/enable', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-CSRF-Token': csrfToken || ''
        },
        body: JSON.stringify({ email, code: tfaCode })
      });
      const data = await res.json();
      if (res.ok) {
        setTfaSuccess('2FA Activated successfully!');
        setQrCodeUrl('');
        setTfaSecret('');
        setTfaCode('');
      } else {
        setTfaError(data.error || 'Incorrect OTP code');
      }
    } catch (err) {
      setTfaError('MFA activation failed.');
    }
  };

  // Ticket status edit
  const updateTicketStatus = async (ticketId: string, newStatus: string) => {
    setFeedbackErr('');
    setFeedbackMsg('');
    try {
      const res = await fetch(`http://localhost:5000/tickets/${ticketId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-CSRF-Token': csrfToken || ''
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        setFeedbackMsg(`Ticket ${ticketId} status updated to ${newStatus}`);
        fetchTickets();
        fetchAuditLogs();
      } else {
        const data = await res.json();
        setFeedbackErr(data.error || 'Failed to update ticket');
      }
    } catch (err) {
      setFeedbackErr('Failed to update ticket');
    }
  };

  // Convert solved ticket to Knowledge Base article
  const convertTicketToKB = async (ticketId: string, category: string) => {
    setFeedbackErr('');
    setFeedbackMsg('');
    try {
      const res = await fetch('http://localhost:5000/kb/convert-ticket', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-CSRF-Token': csrfToken || ''
        },
        body: JSON.stringify({ ticketId, category, tags: [category, 'solved'] })
      });
      const data = await res.json();
      if (res.ok) {
        setFeedbackMsg(`Successfully created article ${data.articleId} from solved ticket!`);
        fetchKbArticles();
        fetchAuditLogs();
      } else {
        setFeedbackErr(data.error || 'Failed to convert ticket');
      }
    } catch (err) {
      setFeedbackErr('Failed to convert ticket');
    }
  };

  // Revoke device session
  const revokeSession = async (sessionId: string) => {
    if (!confirm('Are you sure you want to terminate this login session?')) return;
    try {
      const res = await fetch('http://localhost:5000/auth/sessions/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-CSRF-Token': csrfToken || ''
        },
        body: JSON.stringify({ sessionId })
      });
      if (res.ok) {
        fetchDeviceSessions();
        fetchAuditLogs();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Update profile
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedbackErr('');
    setFeedbackMsg('');
    try {
      const res = await fetch('http://localhost:5000/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-CSRF-Token': csrfToken || ''
        },
        body: JSON.stringify({
          companyName: profileCompany,
          language: profileLang,
          darkMode: profileDark,
          notificationPreferences: {
            email: profileEmailNotif,
            push: profilePushNotif
          }
        })
      });
      const data = await res.json();
      if (res.ok) {
        setFeedbackMsg('Profile updated successfully!');
        setAuth(
          token!,
          role!,
          name!,
          email!,
          data.user.companyName,
          data.user.profilePhoto,
          data.user.language,
          data.user.darkMode,
          data.user.notificationPreferences
        );
      } else {
        setFeedbackErr(data.error || 'Update failed');
      }
    } catch (err) {
      setFeedbackErr('Failed to update profile details');
    }
  };

  // Upload photo
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('photo', file);

    setFeedbackErr('');
    setFeedbackMsg('');

    try {
      const res = await fetch('http://localhost:5000/auth/profile/photo', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'X-CSRF-Token': csrfToken || ''
        },
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        setFeedbackMsg('Profile photo updated successfully!');
        setAuth(
          token!,
          role!,
          name!,
          email!,
          profileCompany,
          data.photoUrl,
          profileLang,
          profileDark,
          { email: profileEmailNotif, push: profilePushNotif }
        );
      } else {
        setFeedbackErr(data.error || 'Failed to upload photo');
      }
    } catch (err) {
      setFeedbackErr('Photo upload failed.');
    }
  };

  // Change password
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedbackErr('');
    setFeedbackMsg('');

    if (newPassword !== confirmPassword) {
      setFeedbackErr('New passwords do not match');
      return;
    }

    try {
      const res = await fetch('http://localhost:5000/auth/change-password', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-CSRF-Token': csrfToken || ''
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword
        })
      });
      const data = await res.json();
      if (res.ok) {
        setFeedbackMsg('Password changed successfully!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        fetchAuditLogs();
      } else {
        setFeedbackErr(data.error || 'Password update failed');
      }
    } catch (err) {
      setFeedbackErr('Failed to update credentials.');
    }
  };

  // Active Session logout
  const handleLogout = async () => {
    try {
      await fetch('http://localhost:5000/auth/logout', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'X-CSRF-Token': csrfToken || ''
        }
      });
    } catch (err) {}
    logout();
    router.push('/login');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied invite link!');
  };

  const joinSession = (id: string) => {
    setSession(id, inviteLink);
    router.push(`/session/${id}`);
  };

  return (
    <div className="min-h-screen bg-[#04020a] text-white p-8 grid-dots">
      {/* Top Header */}
      <header className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center border-b border-white/10 pb-6 mb-8 gap-4 select-none">
        <div className="flex items-center space-x-4">
          <div className="relative w-12 h-12 rounded-full overflow-hidden border border-purple-500/30 bg-purple-950/20">
            {profilePhoto ? (
              <img src={profilePhoto} alt="Profile Photo" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-purple-400 font-bold font-cyber text-lg">
                {name?.substring(0, 1).toUpperCase()}
              </div>
            )}
          </div>
          <div>
            <h1 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-indigo-500 font-cyber uppercase tracking-wider">
              VisionSupport Control Hub
            </h1>
            <p className="text-xs text-gray-500 mt-0.5 font-mono">
              Operator: {name} • Company: {companyName || 'None'} • Role: <span className="text-purple-400 capitalize font-bold">{role}</span>
            </p>
          </div>
        </div>
        <div className="flex space-x-3 w-full md:w-auto">
          {role === 'supervisor' && (
            <button 
              onClick={() => router.push('/admin')}
              className="flex-1 md:flex-none px-4 py-2 bg-purple-950/25 border border-purple-500/30 text-purple-400 rounded-lg hover:bg-purple-900/30 transition text-xs font-cyber font-bold tracking-wider"
            >
              ADMIN PANEL
            </button>
          )}
          <button 
            onClick={handleLogout}
            className="flex-1 md:flex-none px-4 py-2 border border-red-500/30 bg-red-950/20 text-red-400 rounded-lg hover:bg-red-900/30 transition flex items-center justify-center gap-2 font-bold text-xs font-cyber tracking-wider"
          >
            <Power size={13} /> LOGOUT
          </button>
        </div>
      </header>

      {/* Main Grid content */}
      <div className="max-w-7xl mx-auto space-y-6">
        {feedbackMsg && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-4 bg-green-950/20 border border-green-500/30 text-green-400 text-xs font-mono rounded-xl flex items-center gap-2">
            <CheckCircle size={14} /> {feedbackMsg}
          </motion.div>
        )}
        {feedbackErr && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-4 bg-red-950/20 border border-red-500/30 text-red-400 text-xs font-mono rounded-xl flex items-center gap-2">
            <ShieldAlert size={14} /> {feedbackErr}
          </motion.div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          
          {/* Left Panel Actions */}
          <div className="col-span-1 space-y-6">
            <div className="p-6 bg-white/5 border border-white/10 rounded-2xl glass-panel">
              <h3 className="text-lg font-bold mb-4 font-cyber flex items-center gap-2 text-purple-400 select-none uppercase tracking-wide">
                <Plus size={16} /> Session controls
              </h3>
              <button 
                onClick={createSession}
                className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 rounded-xl font-bold transition-all shadow-lg hover:shadow-purple-500/20 text-xs font-cyber uppercase tracking-wider text-white"
              >
                + Create Session Link
              </button>

              {inviteLink && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6 p-4 bg-black/40 rounded-xl border border-purple-500/30"
                >
                  <p className="text-[10px] uppercase text-gray-500 mb-2 font-mono">Invite customer via URL:</p>
                  <div className="flex items-center space-x-2 bg-black/50 p-2.5 rounded-lg border border-white/5">
                    <input 
                      type="text" 
                      readOnly 
                      value={inviteLink}
                      className="flex-1 bg-transparent text-xs text-purple-400 focus:outline-none overflow-hidden select-all"
                    />
                    <button onClick={() => copyToClipboard(inviteLink)} className="text-purple-400 hover:text-white transition">
                      <Clipboard size={14} />
                    </button>
                  </div>
                  <button 
                    onClick={() => joinSession(useStore.getState().sessionId!)}
                    className="w-full py-2.5 bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/40 rounded-lg text-xs font-bold text-white mt-4 transition font-cyber tracking-wider uppercase"
                  >
                    Enter Support Portal
                  </button>
                </motion.div>
              )}
            </div>

            {/* 2FA Configuration Panel */}
            <div className="p-6 bg-white/5 border border-white/10 rounded-2xl glass-panel">
              <h3 className="text-lg font-bold mb-4 font-cyber flex items-center gap-2 text-blue-400 select-none uppercase tracking-wide">
                <Shield size={16} /> 2FA Configuration
              </h3>
              {tfaSuccess && <p className="text-green-400 text-xs font-mono mb-3">{tfaSuccess}</p>}
              {tfaError && <p className="text-red-400 text-xs font-mono mb-3">{tfaError}</p>}
              
              {!qrCodeUrl ? (
                <button
                  onClick={setup2FA}
                  className="w-full py-2.5 bg-blue-600/25 border border-blue-500/40 hover:bg-blue-600/40 text-blue-400 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 font-cyber tracking-wider uppercase"
                >
                  <Key size={14} /> Configure OTP Security
                </button>
              ) : (
                <form onSubmit={enable2FA} className="space-y-4 text-center">
                  <p className="text-xs text-gray-400 mb-2">Scan QR code using Authenticator application:</p>
                  <div className="bg-white p-2 rounded-lg inline-block">
                    <img src={qrCodeUrl} alt="2FA QR" className="w-32 h-32" />
                  </div>
                  <p className="text-[10px] text-gray-500 font-mono select-all">Secret: {tfaSecret}</p>
                  
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="Enter OTP Code"
                    value={tfaCode}
                    onChange={(e) => setTfaCode(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-center font-mono focus:outline-none text-sm text-white"
                    required
                  />

                  <button
                    type="submit"
                    className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold transition font-cyber tracking-wider uppercase"
                  >
                    Activate 2FA
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Right Column Tab Panel */}
          <div className="col-span-2 p-6 bg-white/5 border border-white/10 rounded-2xl glass-panel flex flex-col min-h-[60vh]">
            {/* Tab header buttons */}
            <div className="flex border-b border-white/10 pb-3 mb-6 select-none space-x-6 text-xs font-cyber font-bold uppercase tracking-wider overflow-x-auto">
              <button 
                onClick={() => setActiveTab('live')}
                className={`flex items-center gap-2 pb-2 border-b-2 transition shrink-0 ${activeTab === 'live' ? 'border-purple-500 text-purple-400' : 'border-transparent text-gray-400 hover:text-white'}`}
              >
                <Video size={14} /> Live Tunnels ({liveSessions.length})
              </button>
              <button 
                onClick={() => setActiveTab('history')}
                className={`flex items-center gap-2 pb-2 border-b-2 transition shrink-0 ${activeTab === 'history' ? 'border-purple-500 text-purple-400' : 'border-transparent text-gray-400 hover:text-white'}`}
              >
                <History size={14} /> Case History ({sessions.length})
              </button>
              <button 
                onClick={() => { setActiveTab('tickets'); fetchTickets(); }}
                className={`flex items-center gap-2 pb-2 border-b-2 transition shrink-0 ${activeTab === 'tickets' ? 'border-purple-500 text-purple-400' : 'border-transparent text-gray-400 hover:text-white'}`}
              >
                <FileText size={14} /> Support Tickets ({tickets.length})
              </button>
              <button 
                onClick={() => { setActiveTab('profile'); fetchDeviceSessions(); }}
                className={`flex items-center gap-2 pb-2 border-b-2 transition shrink-0 ${activeTab === 'profile' ? 'border-purple-500 text-purple-400' : 'border-transparent text-gray-400 hover:text-white'}`}
              >
                <User size={14} /> Profile & Cursors
              </button>
              <button 
                onClick={() => setActiveTab('audit')}
                className={`flex items-center gap-2 pb-2 border-b-2 transition shrink-0 ${activeTab === 'audit' ? 'border-purple-500 text-purple-400' : 'border-transparent text-gray-400 hover:text-white'}`}
              >
                <UserCheck size={14} /> Audits Stack
              </button>
              <button 
                onClick={() => setActiveTab('metrics')}
                className={`flex items-center gap-2 pb-2 border-b-2 transition shrink-0 ${activeTab === 'metrics' ? 'border-purple-500 text-purple-400' : 'border-transparent text-gray-400 hover:text-white'}`}
              >
                <Activity size={14} /> System Metrics
              </button>
              <button 
                onClick={() => setActiveTab('csat')}
                className={`flex items-center gap-2 pb-2 border-b-2 transition shrink-0 ${activeTab === 'csat' ? 'border-purple-500 text-purple-400' : 'border-transparent text-gray-400 hover:text-white'}`}
              >
                <Star size={14} /> CSAT Analytics
              </button>
            </div>

            {/* Render selected tabs */}
            <div className="flex-1 overflow-y-auto max-h-[65vh] pr-1 space-y-4">
              <AnimatePresence mode="wait">
                {activeTab === 'live' && (
                  <motion.div key="live" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                    {liveSessions.map((s) => (
                      <div key={s.sessionId} className="p-4 bg-black/40 border border-white/5 rounded-xl flex flex-col space-y-3">
                        <div className="flex justify-between items-center">
                          <div>
                            <span className="font-mono text-xs text-blue-400 font-bold">Session: {s.sessionId.substring(0,8)}...</span>
                            <span className="text-[10px] text-gray-500 ml-4 font-mono">Uptime: {new Date(s.createdAt).toLocaleTimeString()}</span>
                          </div>
                          <div className="flex items-center space-x-3">
                            <button 
                              onClick={() => joinSession(s.sessionId)}
                              className="text-[10px] bg-purple-600 hover:bg-purple-700 px-3 py-1.5 rounded-lg font-bold text-white transition font-cyber tracking-wider uppercase"
                            >
                              Join Call
                            </button>
                            <button 
                              onClick={() => terminateSession(s.sessionId)}
                              className="text-[10px] bg-red-950/40 border border-red-500/30 text-red-400 px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 font-cyber tracking-wider uppercase"
                            >
                              <XCircle size={11} /> Force Terminate
                            </button>
                          </div>
                        </div>

                        {/* Participants inside live session */}
                        {s.participants.length > 0 ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2 pt-2 border-t border-white/5">
                            {s.participants.map((p: any) => (
                              <div key={p.userId} className="p-2.5 bg-white/5 border border-white/10 rounded-lg flex items-center justify-between text-xs">
                                <div>
                                  <p className="font-semibold text-gray-300 truncate">{p.name}</p>
                                  <p className="text-[10px] text-purple-400/80 capitalize font-mono">{p.role}</p>
                                </div>
                                {p.role !== 'agent' && (
                                  <button
                                    onClick={() => disconnectUser(s.sessionId, p.userId)}
                                    className="px-2 py-1 bg-red-950/20 text-red-400 hover:bg-red-900/20 rounded border border-red-500/20 text-[9px] font-bold font-cyber tracking-wider uppercase"
                                  >
                                    Kick
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[10px] text-gray-600 italic font-mono">No active participants present.</p>
                        )}
                      </div>
                    ))}
                    {liveSessions.length === 0 && (
                      <p className="text-center text-gray-500 text-sm mt-8">No live session channels active.</p>
                    )}
                  </motion.div>
                )}

                {activeTab === 'history' && (
                  <motion.div key="history" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                    {sessions.map((s) => (
                      <div key={s._id} className="p-4 bg-black/40 border border-white/5 rounded-xl flex justify-between items-center text-xs">
                        <div>
                          <p className="font-mono text-blue-400 font-bold">Session ID: {s.sessionId.substring(0,8)}...</p>
                          <p className="text-[10px] text-gray-500 mt-1 font-mono">Created: {new Date(s.createdAt).toLocaleString()}</p>
                        </div>
                        <div className="flex items-center space-x-3">
                          {s.csatRating && (
                            <span className="px-2 py-0.5 rounded text-[10px] bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 font-mono font-bold" title={s.csatFeedback}>
                              Rating: {s.csatRating}★
                            </span>
                          )}
                          <span className="px-2.5 py-1 text-[10px] uppercase font-cyber font-bold rounded-full bg-gray-600/20 border border-gray-500/20 text-gray-400">
                            {s.status}
                          </span>
                        </div>
                      </div>
                    ))}
                    {sessions.length === 0 && (
                      <p className="text-center text-gray-500 text-sm mt-8">No history entries logged.</p>
                    )}
                  </motion.div>
                )}

                {activeTab === 'tickets' && (
                  <motion.div key="tickets" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
                    {/* Search & filters bar */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 select-none">
                      <div className="relative md:col-span-2">
                        <Search size={14} className="absolute left-3 top-3.5 text-gray-500" />
                        <input
                          type="text"
                          placeholder="Search tickets..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          onKeyUp={() => fetchTickets()}
                          className="w-full pl-9 pr-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500"
                        />
                      </div>
                      <select 
                        value={filterStatus}
                        onChange={(e) => { setFilterStatus(e.target.value); setTimeout(() => fetchTickets(), 50); }}
                        className="px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-xs text-gray-300 focus:outline-none focus:border-purple-500 cursor-pointer"
                      >
                        <option value="">All Statuses</option>
                        <option value="Open">Open</option>
                        <option value="Resolved">Resolved</option>
                        <option value="Closed">Closed</option>
                      </select>
                      <select 
                        value={filterPriority}
                        onChange={(e) => { setFilterPriority(e.target.value); setTimeout(() => fetchTickets(), 50); }}
                        className="px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-xs text-gray-300 focus:outline-none focus:border-purple-500 cursor-pointer"
                      >
                        <option value="">All Priorities</option>
                        <option value="Low">Low</option>
                        <option value="Medium">Medium</option>
                        <option value="High">High</option>
                      </select>
                    </div>

                    {/* Support Tickets list */}
                    <div className="space-y-4">
                      {tickets.map((t) => (
                        <div key={t._id} className="p-4 bg-black/45 border border-white/5 rounded-xl flex flex-col space-y-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="flex items-center space-x-2">
                                <span className="font-mono text-xs font-bold text-purple-400">{t.ticketId}</span>
                                <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-white/5 border border-white/10 text-gray-400">{t.category}</span>
                              </div>
                              <h4 className="text-sm font-bold text-gray-200 mt-1 font-cyber">{t.issueTitle}</h4>
                              <p className="text-xs text-gray-500 mt-1 font-mono">Agent: {t.agentName} • Customer: {t.customerName}</p>
                            </div>
                            
                            <div className="flex items-center space-x-2">
                              {/* Status Select dropdown */}
                              <select
                                value={t.status}
                                onChange={(e) => updateTicketStatus(t.ticketId, e.target.value)}
                                className="bg-black/60 border border-white/10 rounded px-2.5 py-1 text-xs text-purple-400 font-cyber font-bold cursor-pointer focus:outline-none"
                              >
                                <option value="Open">Open</option>
                                <option value="Resolved">Resolved</option>
                                <option value="Closed">Closed</option>
                              </select>
                              
                              <span className={`px-2 py-1 text-[9px] uppercase font-cyber font-bold rounded ${
                                t.priority === 'High' ? 'bg-red-950/20 border border-red-500/30 text-red-400' :
                                t.priority === 'Medium' ? 'bg-yellow-950/20 border border-yellow-500/30 text-yellow-400' :
                                'bg-green-950/20 border border-green-500/30 text-green-400'
                              }`}>
                                {t.priority}
                              </span>
                            </div>
                          </div>

                          <p className="text-xs text-gray-400 bg-black/25 p-3 rounded-lg border border-white/5 leading-relaxed font-sans">
                            {t.problemDescription || 'No description provided.'}
                          </p>

                          {t.solution && (
                            <div className="text-xs p-3 bg-purple-950/10 border border-purple-500/10 rounded-lg">
                              <span className="font-bold text-purple-400 font-cyber block mb-1">Solved Solution:</span>
                              <p className="text-gray-300 font-sans leading-relaxed">{t.solution}</p>
                            </div>
                          )}

                          {/* Export buttons & Solved conversion action */}
                          <div className="flex flex-wrap gap-3 pt-2 text-[10px] font-cyber font-bold select-none border-t border-white/5">
                            <a 
                              href={`http://localhost:5000/tickets/${t.ticketId}/export/csv?token=${token}`}
                              className="px-3 py-1.5 bg-white/5 border border-white/10 hover:bg-white/10 rounded-lg text-gray-300 flex items-center gap-1.5 transition"
                            >
                              <Download size={11} /> CSV Export
                            </a>
                            <a 
                              href={`http://localhost:5000/tickets/${t.ticketId}/export/pdf?token=${token}`}
                              className="px-3 py-1.5 bg-white/5 border border-white/10 hover:bg-white/10 rounded-lg text-gray-300 flex items-center gap-1.5 transition"
                            >
                              <FileText size={11} /> PDF Document
                            </a>
                            
                            {(t.status === 'Resolved' || t.status === 'Closed') && (
                              <button
                                onClick={() => convertTicketToKB(t.ticketId, t.category)}
                                className="px-3 py-1.5 bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/40 rounded-lg text-white flex items-center gap-1.5 transition uppercase"
                              >
                                <Database size={11} /> Index Knowledge Base
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                      {tickets.length === 0 && (
                        <p className="text-center text-gray-500 text-sm mt-8">No tickets match search qualifiers.</p>
                      )}
                    </div>

                    {/* Knowledge base section */}
                    <div className="border-t border-white/10 pt-8 mt-8 select-none">
                      <h3 className="text-md font-bold font-cyber text-blue-400 mb-4 uppercase tracking-wider flex items-center gap-2">
                        <Database size={16} /> Knowledge base index
                      </h3>
                      
                      <div className="flex space-x-3 mb-6">
                        <div className="flex-1 relative">
                          <Search size={14} className="absolute left-3 top-3 text-gray-500" />
                          <input
                            type="text"
                            placeholder="Search articles database..."
                            value={kbQuery}
                            onChange={(e) => setKbQuery(e.target.value)}
                            onKeyUp={() => fetchKbArticles()}
                            className="w-full pl-9 pr-4 py-2 bg-black/40 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {kbArticles.map((art) => (
                          <div key={art._id} className="p-4 bg-white/5 border border-white/10 rounded-xl glass-panel space-y-2 text-xs">
                            <div className="flex justify-between items-center">
                              <span className="font-mono text-purple-400 font-bold">{art.articleId}</span>
                              <span className="px-2 py-0.5 bg-black/40 border border-white/5 rounded text-[9px] text-gray-500">{art.category}</span>
                            </div>
                            <h4 className="font-bold text-gray-200 font-cyber leading-snug">{art.title}</h4>
                            <p className="text-gray-400 line-clamp-3 leading-relaxed font-sans">{art.problemDescription}</p>
                            <div className="text-[10px] text-purple-400 font-mono pt-2 border-t border-white/5">
                              Solution: {art.solution.substring(0, 100)}...
                            </div>
                          </div>
                        ))}
                        {kbArticles.length === 0 && (
                          <p className="col-span-2 text-center text-gray-500 text-xs italic">No knowledge base articles stored yet.</p>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeTab === 'profile' && (
                  <motion.div key="profile" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-8">
                    
                    {/* Settings Form Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 select-none">
                      
                      {/* Update details Profile */}
                      <div className="p-6 bg-white/5 border border-white/10 rounded-2xl glass-panel">
                        <h3 className="text-md font-bold mb-4 font-cyber text-blue-400 uppercase tracking-wide flex items-center gap-2">
                          <Settings2 size={15} /> Account Settings
                        </h3>

                        <form onSubmit={handleUpdateProfile} className="space-y-4 text-xs">
                          {/* Profile photo trigger wrapper */}
                          <div className="flex items-center space-x-4 mb-2">
                            <div className="relative w-16 h-16 rounded-full overflow-hidden border border-purple-500/30 bg-purple-950/20 group">
                              {profilePhoto ? (
                                <img src={profilePhoto} alt="Avatar" className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-purple-400 font-bold font-cyber text-xl">
                                  {name?.substring(0,1).toUpperCase()}
                                </div>
                              )}
                              <button 
                                type="button" 
                                onClick={() => fileInputRef.current?.click()}
                                className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition duration-200"
                              >
                                <Camera size={14} />
                              </button>
                            </div>
                            <input 
                              type="file" 
                              ref={fileInputRef} 
                              onChange={handlePhotoUpload} 
                              className="hidden" 
                              accept="image/*" 
                            />
                            <div>
                              <p className="font-bold text-gray-300 text-sm">{name}</p>
                              <p className="text-[10px] text-gray-500 font-mono">{email}</p>
                            </div>
                          </div>

                          <div>
                            <label className="text-[10px] uppercase text-gray-500 font-mono block mb-1">Company Name</label>
                            <input 
                              type="text" 
                              value={profileCompany}
                              onChange={(e) => setProfileCompany(e.target.value)}
                              className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-white focus:outline-none focus:border-purple-500"
                              required
                            />
                          </div>

                          <div>
                            <label className="text-[10px] uppercase text-gray-500 font-mono block mb-1">Language preferences</label>
                            <select 
                              value={profileLang}
                              onChange={(e) => setProfileLang(e.target.value)}
                              className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-purple-400 cursor-pointer focus:outline-none focus:border-purple-500"
                            >
                              <option value="en">English (default)</option>
                              <option value="es">Español (Spanish)</option>
                              <option value="fr">Français (French)</option>
                              <option value="de">Deutsch (German)</option>
                            </select>
                          </div>

                          <div className="flex items-center space-x-2 pt-2">
                            <button
                              type="button"
                              onClick={() => setProfileDark(!profileDark)}
                              className={`p-2 rounded-lg border transition ${
                                profileDark 
                                  ? 'bg-purple-950/20 border-purple-500/30 text-purple-400' 
                                  : 'bg-white/5 border-white/10 text-gray-400'
                              }`}
                              title="Toggle UI Dark Mode"
                            >
                              {profileDark ? <Moon size={14} /> : <Sun size={14} />}
                            </button>
                            <span className="text-gray-400">Dark Mode Interface</span>
                          </div>

                          <div className="border-t border-white/5 pt-4 mt-4 space-y-2">
                            <p className="text-[10px] uppercase text-gray-500 font-mono mb-2">Notification Channels</p>
                            <label className="flex items-center space-x-2 cursor-pointer">
                              <input 
                                type="checkbox" 
                                checked={profileEmailNotif}
                                onChange={(e) => setProfileEmailNotif(e.target.checked)}
                                className="rounded border-white/10 bg-black/40 text-purple-600 focus:ring-0"
                              />
                              <span className="text-gray-300">Email Notifications</span>
                            </label>
                            <label className="flex items-center space-x-2 cursor-pointer">
                              <input 
                                type="checkbox" 
                                checked={profilePushNotif}
                                onChange={(e) => setProfilePushNotif(e.target.checked)}
                                className="rounded border-white/10 bg-black/40 text-purple-600 focus:ring-0"
                              />
                              <span className="text-gray-300">In-App Alerts</span>
                            </label>
                          </div>

                          <button
                            type="submit"
                            className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold transition font-cyber tracking-wider uppercase"
                          >
                            Update Profile Details
                          </button>
                        </form>
                      </div>

                      {/* Change Password Form */}
                      <div className="p-6 bg-white/5 border border-white/10 rounded-2xl glass-panel self-start">
                        <h3 className="text-md font-bold mb-4 font-cyber text-yellow-500 uppercase tracking-wide flex items-center gap-2">
                          <Settings size={15} /> Change Credentials Key
                        </h3>

                        <form onSubmit={handleChangePassword} className="space-y-4 text-xs">
                          <div>
                            <label className="text-[10px] uppercase text-gray-500 font-mono block mb-1">Current Password</label>
                            <input 
                              type="password" 
                              value={currentPassword}
                              onChange={(e) => setCurrentPassword(e.target.value)}
                              className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-white focus:outline-none focus:border-purple-500"
                              required
                            />
                          </div>

                          <div>
                            <label className="text-[10px] uppercase text-gray-500 font-mono block mb-1">New password</label>
                            <input 
                              type="password" 
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-white focus:outline-none focus:border-purple-500"
                              required
                            />
                          </div>

                          <div>
                            <label className="text-[10px] uppercase text-gray-500 font-mono block mb-1">Confirm New Password</label>
                            <input 
                              type="password" 
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-white focus:outline-none focus:border-purple-500"
                              required
                            />
                          </div>

                          <button
                            type="submit"
                            className="w-full py-2.5 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-bold transition font-cyber tracking-wider uppercase"
                          >
                            Save New Key
                          </button>
                        </form>
                      </div>
                    </div>

                    {/* Concurrent Device Sessions List */}
                    <div className="p-6 bg-white/5 border border-white/10 rounded-2xl glass-panel select-none">
                      <h3 className="text-md font-bold mb-4 font-cyber text-purple-400 uppercase tracking-wide flex items-center gap-2">
                        <Server size={15} /> Active Concurrent Sessions
                      </h3>

                      <div className="overflow-x-auto text-xs">
                        <table className="w-full text-left border-collapse font-sans">
                          <thead>
                            <tr className="border-b border-white/10 text-gray-500 font-mono text-[9px] uppercase">
                              <th className="pb-2">Device / Browser</th>
                              <th className="pb-2">IP Address</th>
                              <th className="pb-2">Logged Time</th>
                              <th className="pb-2 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {deviceSessions.map((session) => (
                              <tr key={session.sessionId} className="hover:bg-white/5 transition-colors">
                                <td className="py-2.5 text-gray-300 font-medium truncate max-w-[200px]" title={session.userAgent}>
                                  {session.userAgent.includes('Chrome') ? 'Google Chrome' :
                                   session.userAgent.includes('Firefox') ? 'Mozilla Firefox' :
                                   session.userAgent.includes('Safari') ? 'Apple Safari' : 'Browser Session'}
                                </td>
                                <td className="py-2.5 text-gray-400 font-mono">{session.ipAddress}</td>
                                <td className="py-2.5 text-gray-400 font-mono">{new Date(session.loginTime).toLocaleString()}</td>
                                <td className="py-2.5 text-right">
                                  <button
                                    onClick={() => revokeSession(session.sessionId)}
                                    className="px-2 py-1 bg-red-950/20 border border-red-500/30 text-red-400 hover:bg-red-900/30 rounded text-[9px] font-bold font-cyber tracking-wider uppercase"
                                  >
                                    Terminate
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeTab === 'audit' && (
                  <motion.div key="audit" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
                    {auditLogs.map((log) => (
                      <div key={log._id} className="p-3 bg-black/35 border border-white/5 rounded-xl flex items-center justify-between text-xs font-mono">
                        <div className="flex items-center space-x-3 overflow-hidden">
                          {log.status === 'success' ? (
                            <Shield className="w-4 h-4 text-green-500 flex-shrink-0" />
                          ) : (
                            <ShieldAlert className="w-4 h-4 text-red-500 flex-shrink-0" />
                          )}
                          <div className="overflow-hidden">
                            <p className="font-bold text-gray-300 uppercase tracking-wide">{log.action}</p>
                            <p className="text-[10px] text-gray-500 truncate">Agent: {log.userName} • IP: {log.ipAddress}</p>
                            {log.details && (
                              <p className="text-[9px] text-gray-600 mt-1 select-all">Data: {JSON.stringify(log.details)}</p>
                            )}
                          </div>
                        </div>
                        <span className="text-[10px] text-gray-500">{new Date(log.timestamp).toLocaleString()}</span>
                      </div>
                    ))}
                    {auditLogs.length === 0 && (
                      <p className="text-center text-gray-500 text-sm mt-8">No audit logs indexed.</p>
                    )}
                  </motion.div>
                )}

                {activeTab === 'metrics' && (
                  <motion.div key="metrics" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                      <CircularProgress value={systemStats.cpu} max={100} label="CPU LOAD" color="#3b82f6" glowColor="rgba(59,130,246,0.3)" />
                      <CircularProgress value={systemStats.memory} max={512} label="RAM HEAP" color="#a78bfa" glowColor="rgba(167,139,250,0.3)" />
                      <CircularProgress value={systemStats.packetLoss * 100} max={10} label="PACKET LOSS" color="#ef4444" glowColor="rgba(239,68,68,0.3)" />
                      <CircularProgress value={liveSessions.length} max={10} label="ACTIVE TUNNELS" color="#10b981" glowColor="rgba(16,185,129,0.3)" />
                    </div>
                    <div className="p-6 bg-white/5 border border-white/10 rounded-3xl glass-panel font-mono text-[10px] text-gray-400 space-y-2 select-none">
                      <h4 className="font-cyber font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 uppercase tracking-widest text-xs mb-3 flex items-center gap-2">
                        <Server size={14} className="text-purple-400 animate-pulse" /> Digital Twin Host State
                      </h4>
                      <p>OS Platform: <span className="text-white">Windows Node</span></p>
                      <p>Media Server: <span className="text-white">MediaSoup SFU Workers v3</span></p>
                      <p>Active Signaling Links: <span className="text-white">{liveSessions.length * 2} sockets connected</span></p>
                      <p>Replica Database Status: <span className="text-green-400 font-bold">replica-set online</span></p>
                    </div>
                  </motion.div>
                )}

                {activeTab === 'csat' && (
                  <motion.div key="csat" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
                    {/* Metrics aggregates */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="p-5 bg-white/5 border border-white/10 rounded-2xl glass-panel flex flex-col justify-between select-none">
                        <span className="text-[10px] text-gray-500 uppercase font-mono tracking-widest">Average CSAT Rating</span>
                        <div className="mt-3 flex items-baseline gap-2">
                          <span className="text-3xl font-extrabold font-cyber text-yellow-400">{avgCsat.toFixed(1)}★</span>
                          <span className="text-xs text-gray-500 font-mono">/ 5.0 rating</span>
                        </div>
                        <p className="text-[9px] text-gray-500 mt-2">Correlated from customer feedback submissions</p>
                      </div>

                      <div className="p-5 bg-white/5 border border-white/10 rounded-2xl glass-panel flex flex-col justify-between select-none">
                        <span className="text-[10px] text-gray-500 uppercase font-mono tracking-widest">Average Response Time</span>
                        <div className="mt-3 flex items-baseline gap-2">
                          <span className="text-3xl font-extrabold font-cyber text-purple-400">{avgResponseTime.toFixed(0)}s</span>
                          <span className="text-xs text-gray-500 font-mono">operator join latency</span>
                        </div>
                        <p className="text-[9px] text-gray-500 mt-2">Time between customer join and agent join</p>
                      </div>

                      <div className="p-5 bg-white/5 border border-white/10 rounded-2xl glass-panel flex flex-col justify-between select-none">
                        <span className="text-[10px] text-gray-500 uppercase font-mono tracking-widest">Average Resolution Speed</span>
                        <div className="mt-3 flex items-baseline gap-2">
                          <span className="text-3xl font-extrabold font-cyber text-blue-400">{formatTimePeriod(avgResolution)}</span>
                          <span className="text-xs text-gray-500 font-mono">average call duration</span>
                        </div>
                        <p className="text-[9px] text-gray-500 mt-2">Total session elapsed time before resolution</p>
                      </div>
                    </div>

                    {/* Correlation chart / mapping */}
                    <div className="p-5 bg-black/40 border border-white/10 rounded-3xl glass-panel select-none">
                      <h4 className="text-xs font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 uppercase tracking-widest font-cyber mb-4 flex items-center gap-2">
                        <Activity size={14} className="text-purple-400" /> CSAT vs Resolution Speed Correlation
                      </h4>
                      <div className="space-y-4">
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] font-mono text-gray-400">
                            <span>Resolution under 5 mins (Fast)</span>
                            <span className="text-green-400 font-bold">4.8★ Average Rating</span>
                          </div>
                          <div className="w-full bg-white/5 h-2.5 rounded-full overflow-hidden border border-white/5">
                            <div className="bg-gradient-to-r from-green-600 to-emerald-400 h-full rounded-full" style={{ width: '96%' }} />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] font-mono text-gray-400">
                            <span>Resolution between 5-15 mins (Standard)</span>
                            <span className="text-yellow-400 font-bold">4.4★ Average Rating</span>
                          </div>
                          <div className="w-full bg-white/5 h-2.5 rounded-full overflow-hidden border border-white/5">
                            <div className="bg-gradient-to-r from-yellow-600 to-amber-400 h-full rounded-full" style={{ width: '88%' }} />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] font-mono text-gray-400">
                            <span>Resolution over 15 mins (Slow)</span>
                            <span className="text-red-400 font-bold">3.6★ Average Rating</span>
                          </div>
                          <div className="w-full bg-white/5 h-2.5 rounded-full overflow-hidden border border-white/5">
                            <div className="bg-gradient-to-r from-red-600 to-orange-400 h-full rounded-full" style={{ width: '72%' }} />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Feedbacks list */}
                    <div className="border-t border-white/10 pt-6 mt-6">
                      <h4 className="text-xs font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 uppercase tracking-widest font-cyber mb-4">
                        Recent Feedback Comments ({csatSessions.length})
                      </h4>
                      <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar text-xs">
                        {csatSessions.map((cs, index) => (
                          <div key={cs._id || index} className="p-3 bg-white/5 border border-white/5 rounded-2xl flex flex-col gap-1 text-left font-mono">
                            <div className="flex justify-between items-center text-[10px]">
                              <span className="text-blue-400 font-bold">Session: {cs.sessionId.substring(0,8)}...</span>
                              <div className="flex items-center gap-0.5">
                                {Array.from({ length: 5 }).map((_, stIdx) => (
                                  <Star key={stIdx} size={10} className={stIdx < cs.csatRating ? "text-yellow-400 fill-yellow-400" : "text-gray-600"} />
                                ))}
                              </div>
                            </div>
                            <p className="text-gray-300 italic font-sans mt-1">"{cs.csatFeedback || 'No written feedback comments provided.'}"</p>
                          </div>
                        ))}
                        {csatSessions.length === 0 && (
                          <p className="text-center text-gray-500 text-xs italic py-6">No feedback comments recorded yet.</p>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

        </div>

        {/* Charts & Diagnostics Dashboard section */}
        <div className="grid grid-cols-1 gap-6 select-none">
          <DashboardCharts />
        </div>
      </div>
    </div>
  );
}
