"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/store/useStore';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, Power, Key, Shield, Video, History, UserCheck, ShieldAlert, XCircle, 
  Users, UserPlus, Sliders, Activity, Terminal, CheckCircle2, ShieldOff 
} from 'lucide-react';

export default function AdminPanel() {
  const router = useRouter();
  const { token, role, name, email } = useStore();

  const [users, setUsers] = useState<any[]>([]);
  const [liveSessions, setLiveSessions] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>({
    totalSessions: 0,
    activeSessions: 0,
    avgDuration: 0,
    resolutionRate: 0,
    csatScore: 0
  });

  // UI state managers
  const [activeTab, setActiveTab] = useState<'telemetry' | 'agents' | 'audits'>('telemetry');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Form states: Create User
  const [createName, setCreateName] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createRole, setCreateRole] = useState<'agent' | 'supervisor' | 'observer'>('agent');

  // Form states: Reset Password
  const [selectedUserId, setSelectedUserId] = useState('');
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    // Only agents and supervisors are allowed to view this hidden panel
    if (!token || (role !== 'agent' && role !== 'supervisor')) {
      return;
    }

    fetchUsers();
    fetchLiveSessions();
    fetchAuditLogs();
    fetchAnalyticsSummary();

    const interval = setInterval(() => {
      fetchLiveSessions();
      fetchAnalyticsSummary();
    }, 5000);

    return () => clearInterval(interval);
  }, [token, role]);

  const fetchUsers = async () => {
    try {
      const res = await fetch('http://localhost:5000/admin/users', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setUsers(data);
    } catch (err) {
      console.error('Failed to load user directory', err);
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

  const fetchAnalyticsSummary = async () => {
    try {
      const res = await fetch('http://localhost:5000/admin/analytics/summary', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setAnalytics(data);
    } catch (err) {
      console.error('Failed to load analytics summary', err);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const res = await fetch('http://localhost:5000/admin/users/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: createName,
          email: createEmail,
          password: createPassword,
          role: createRole
        })
      });

      const data = await res.json();
      setLoading(false);

      if (res.ok) {
        setMessage(`Successfully provisioned agent account for ${createEmail}`);
        setCreateName('');
        setCreateEmail('');
        setCreatePassword('');
        setCreateRole('agent');
        fetchUsers();
        fetchAuditLogs();
      } else {
        setError(data.error || 'Failed to create agent');
      }
    } catch (err) {
      setLoading(false);
      setError('Connection failed. User could not be created.');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    if (!selectedUserId || !newPassword) return;
    setLoading(true);

    try {
      const res = await fetch('http://localhost:5000/admin/users/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ userId: selectedUserId, newPassword })
      });

      const data = await res.json();
      setLoading(false);

      if (res.ok) {
        setMessage(data.message || 'Password reset successfully');
        setNewPassword('');
        setSelectedUserId('');
        fetchAuditLogs();
      } else {
        setError(data.error || 'Reset failed');
      }
    } catch (err) {
      setLoading(false);
      setError('Connection failed. Password could not be reset.');
    }
  };

  const handleUpdateRole = async (userId: string, role: string) => {
    setError('');
    setMessage('');
    try {
      const res = await fetch('http://localhost:5000/admin/users/update-role', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ userId, role })
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(data.message);
        fetchUsers();
        fetchAuditLogs();
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to update role');
    }
  };

  const handleToggle2FA = async (userId: string, twoFactorEnabled: boolean) => {
    setError('');
    setMessage('');
    try {
      const res = await fetch('http://localhost:5000/admin/users/toggle-2fa', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ userId, twoFactorEnabled })
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(data.message);
        fetchUsers();
        fetchAuditLogs();
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to update 2FA status');
    }
  };

  const handleToggleDisabled = async (userId: string, disabled: boolean) => {
    setError('');
    setMessage('');
    try {
      const res = await fetch('http://localhost:5000/admin/users/toggle-disabled', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ userId, disabled })
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(data.message);
        fetchUsers();
        fetchAuditLogs();
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to toggle user status');
    }
  };

  const terminateSession = async (sessionId: string) => {
    if (!confirm('Are you sure you want to force terminate this session?')) return;
    try {
      const res = await fetch('http://localhost:5000/admin/sessions/terminate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
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

  // If user is not logged in as an Agent/Supervisor, block access
  if (!token || (role !== 'agent' && role !== 'supervisor')) {
    return (
      <div className="min-h-screen bg-[#04020a] text-white flex items-center justify-center p-8 grid-dots">
        <div className="max-w-md w-full p-8 border border-red-500/25 bg-red-950/10 backdrop-blur-lg rounded-2xl text-center glass-panel shadow-lg select-none">
          <ShieldAlert className="w-16 h-16 text-red-500 mx-auto mb-4 animate-pulse" />
          <h2 className="text-2xl font-bold font-cyber text-red-400 mb-2">Access Denied</h2>
          <p className="text-gray-400 text-sm mb-6">
            Admin console access restricted. Operator authentication required.
          </p>
          <button 
            onClick={() => router.push('/login')}
            className="w-full py-3 bg-gradient-to-r from-red-600 to-purple-600 rounded-xl font-bold text-sm tracking-wide transition hover:opacity-90"
          >
            Authenticate Agent
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#04020a] text-white p-8 grid-dots">
      {/* Top Header */}
      <header className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center border-b border-white/10 pb-6 mb-8 gap-4 select-none">
        <div>
          <h1 className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-indigo-500 font-cyber">
            Holographic Command Panel
          </h1>
          <p className="text-xs text-gray-500 mt-1 font-mono">
            System Administrator: {name} • Role: <span className="text-purple-400 capitalize">{role}</span>
          </p>
        </div>
        <div className="flex space-x-3 w-full md:w-auto">
          <button 
            onClick={() => router.push('/dashboard')}
            className="flex-1 md:flex-none px-4 py-2 bg-white/5 border border-white/10 text-gray-300 rounded-lg hover:bg-white/10 transition text-sm font-semibold"
          >
            Dashboard
          </button>
          <button 
            onClick={() => { useStore.getState().logout(); router.push('/login'); }}
            className="flex-1 md:flex-none px-4 py-2 border border-red-500/30 bg-red-950/20 text-red-400 rounded-lg hover:bg-red-900/30 transition flex items-center justify-center gap-2 font-semibold text-sm"
          >
            <Power size={14} /> Exit Admin
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto space-y-6">
        {/* Status Alerts */}
        {message && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-4 bg-green-950/20 border border-green-500/30 text-green-400 text-xs font-mono rounded-xl flex items-center gap-2">
            <CheckCircle2 size={14} /> {message}
          </motion.div>
        )}
        {error && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-4 bg-red-950/20 border border-red-500/30 text-red-400 text-xs font-mono rounded-xl flex items-center gap-2">
            <ShieldAlert size={14} /> {error}
          </motion.div>
        )}

        {/* Navigation Tabs */}
        <div className="flex bg-white/5 border border-white/10 p-1.5 rounded-xl self-start space-x-2 select-none text-xs font-cyber font-bold max-w-md">
          <button
            onClick={() => setActiveTab('telemetry')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${activeTab === 'telemetry' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            <Activity size={12} /> System Telemetry
          </button>
          <button
            onClick={() => setActiveTab('agents')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${activeTab === 'agents' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            <Users size={12} /> Agent Directory
          </button>
          <button
            onClick={() => setActiveTab('audits')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${activeTab === 'audits' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            <Terminal size={12} /> Security Logs
          </button>
        </div>

        {/* Tabs Content */}
        <div className="w-full">
          <AnimatePresence mode="wait">
            {activeTab === 'telemetry' && (
              <motion.div 
                key="telemetry"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-8"
              >
                {/* Statistics Grid */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="p-6 bg-white/5 border border-white/10 rounded-2xl glass-panel text-center">
                    <p className="text-xs text-gray-400 uppercase tracking-widest font-cyber">Total Sessions</p>
                    <p className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400 mt-2">
                      {analytics.totalSessions}
                    </p>
                  </div>
                  <div className="p-6 bg-white/5 border border-white/10 rounded-2xl glass-panel text-center">
                    <p className="text-xs text-gray-400 uppercase tracking-widest font-cyber">Active Channels</p>
                    <p className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 mt-2">
                      {analytics.activeSessions}
                    </p>
                  </div>
                  <div className="p-6 bg-white/5 border border-white/10 rounded-2xl glass-panel text-center">
                    <p className="text-xs text-gray-400 uppercase tracking-widest font-cyber">Avg Duration</p>
                    <p className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-400 mt-2">
                      {Math.round(analytics.avgDuration / 60)} min
                    </p>
                  </div>
                  <div className="p-6 bg-white/5 border border-white/10 rounded-2xl glass-panel text-center">
                    <p className="text-xs text-gray-400 uppercase tracking-widest font-cyber">Customer SAT</p>
                    <p className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-amber-500 mt-2">
                      {analytics.csatScore * 20}%
                    </p>
                  </div>
                </div>

                {/* Telemetry and active list split */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Live Active Channels */}
                  <div className="lg:col-span-2 p-6 bg-white/5 border border-white/10 rounded-2xl glass-panel flex flex-col min-h-[40vh]">
                    <h3 className="text-lg font-bold font-cyber text-purple-400 flex items-center gap-2 mb-4">
                      <Video size={16} /> Live Transmission Feeds
                    </h3>
                    
                    <div className="flex-1 overflow-y-auto space-y-4 max-h-[50vh] pr-1">
                      {liveSessions.map((s) => (
                        <div key={s.sessionId} className="p-4 bg-black/40 border border-white/5 rounded-xl flex flex-col space-y-3">
                          <div className="flex justify-between items-center">
                            <div>
                              <span className="font-mono text-xs text-blue-400 font-bold">Session: {s.sessionId.substring(0,12)}...</span>
                              <span className="text-[10px] text-gray-500 ml-4 font-mono">Uptime: {new Date(s.createdAt).toLocaleTimeString()}</span>
                            </div>
                            <button 
                              onClick={() => terminateSession(s.sessionId)}
                              className="text-xs bg-red-950/40 border border-red-500/30 text-red-400 hover:bg-red-900/30 px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5"
                            >
                              <XCircle size={12} /> Force Terminate
                            </button>
                          </div>

                          {/* Render participants inside live session */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2 pt-2 border-t border-white/5">
                            {s.participants.length > 0 ? (
                              s.participants.map((p: any) => (
                                <div key={p.userId} className="p-2.5 bg-white/5 border border-white/10 rounded-lg flex items-center justify-between text-xs">
                                  <div>
                                    <p className="font-semibold text-gray-300 truncate">{p.name}</p>
                                    <p className="text-[10px] text-purple-400 capitalize">{p.role}</p>
                                  </div>
                                  <div className="text-right text-[10px] text-gray-500 font-mono">
                                    <p>Ping: {p.latency || 12}ms</p>
                                    <p>Loss: {p.packetLoss || 0}%</p>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <p className="text-[10px] text-gray-500 italic col-span-2">No connected participants inside this room.</p>
                            )}
                          </div>
                        </div>
                      ))}
                      {liveSessions.length === 0 && (
                        <p className="text-center text-gray-500 text-sm mt-8">No live sessions currently running.</p>
                      )}
                    </div>
                  </div>

                  {/* Telemetry charts/meters */}
                  <div className="col-span-1 p-6 bg-white/5 border border-white/10 rounded-2xl glass-panel space-y-6">
                    <h3 className="text-lg font-bold font-cyber text-blue-400 flex items-center gap-2">
                      <Sliders size={16} /> Signal Strength
                    </h3>
                    
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-xs text-gray-400 mb-1">
                          <span>Bandwidth Utilization</span>
                          <span>76%</span>
                        </div>
                        <div className="w-full bg-black/40 h-2 rounded-full overflow-hidden">
                          <div className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full w-[76%] rounded-full" />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-xs text-gray-400 mb-1">
                          <span>Server CPU Threads</span>
                          <span>42%</span>
                        </div>
                        <div className="w-full bg-black/40 h-2 rounded-full overflow-hidden">
                          <div className="bg-gradient-to-r from-purple-500 to-indigo-500 h-full w-[42%] rounded-full" />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-xs text-gray-400 mb-1">
                          <span>RAM Allocation</span>
                          <span>58%</span>
                        </div>
                        <div className="w-full bg-black/40 h-2 rounded-full overflow-hidden">
                          <div className="bg-gradient-to-r from-pink-500 to-purple-500 h-full w-[58%] rounded-full" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'agents' && (
              <motion.div 
                key="agents"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="grid grid-cols-1 lg:grid-cols-3 gap-8"
              >
                {/* Table of active users directory */}
                <div className="lg:col-span-2 p-6 bg-white/5 border border-white/10 rounded-2xl glass-panel flex flex-col min-h-[50vh]">
                  <h3 className="text-lg font-bold font-cyber text-purple-400 flex items-center gap-2 mb-6">
                    <Users size={16} /> System Operators
                  </h3>

                  <div className="flex-1 overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs select-none">
                      <thead>
                        <tr className="border-b border-white/10 text-gray-400 uppercase tracking-widest text-[10px] font-mono">
                          <th className="pb-3">Name</th>
                          <th className="pb-3">Email</th>
                          <th className="pb-3">Role</th>
                          <th className="pb-3 text-center">2FA Active</th>
                          <th className="pb-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                         {users.map((u) => (
                          <tr key={u._id} className="hover:bg-white/5 transition-colors">
                            <td className="py-3 font-semibold text-gray-300">
                              {u.name} {u.disabled && <span className="text-red-400 font-mono text-[9px] uppercase ml-1.5">(Disabled)</span>}
                            </td>
                            <td className="py-3 text-gray-400 font-mono">{u.email}</td>
                            <td className="py-3">
                              <select 
                                value={u.role} 
                                onChange={(e) => handleUpdateRole(u._id, e.target.value)}
                                className="bg-black/50 border border-white/10 rounded px-2 py-1 text-purple-400 text-xs focus:outline-none focus:border-purple-500 cursor-pointer"
                              >
                                <option value="agent">Agent</option>
                                <option value="supervisor">Supervisor</option>
                                <option value="observer">Observer</option>
                              </select>
                            </td>
                            <td className="py-3 text-center">
                              <button 
                                onClick={() => handleToggle2FA(u._id, !u.twoFactorEnabled)}
                                className={`px-2 py-1 rounded text-[10px] font-mono font-bold transition border ${
                                  u.twoFactorEnabled 
                                    ? 'bg-green-950/20 border-green-500/30 text-green-400' 
                                    : 'bg-red-950/20 border-red-500/30 text-red-400'
                                }`}
                              >
                                {u.twoFactorEnabled ? 'Enabled' : 'Disabled'}
                              </button>
                            </td>
                            <td className="py-3 text-right space-x-1.5">
                              <button 
                                onClick={() => setSelectedUserId(u._id)}
                                className="text-[10px] bg-white/5 border border-white/15 px-2.5 py-1 rounded hover:bg-white/10 transition text-gray-300 font-bold"
                              >
                                Reset Pass
                              </button>
                              <button 
                                onClick={() => handleToggleDisabled(u._id, !u.disabled)}
                                className={`text-[10px] px-2.5 py-1 rounded font-bold transition border ${
                                  u.disabled 
                                    ? 'bg-green-950/20 border-green-500/30 text-green-400' 
                                    : 'bg-red-950/20 border-red-500/30 text-red-400'
                                }`}
                              >
                                {u.disabled ? 'Enable' : 'Disable'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Left controls forms */}
                <div className="space-y-6">
                  {/* Create New User */}
                  <div className="p-6 bg-white/5 border border-white/10 rounded-2xl glass-panel">
                    <h3 className="text-md font-bold font-cyber text-blue-400 flex items-center gap-2 mb-4">
                      <UserPlus size={15} /> Provision Operator
                    </h3>

                    <form onSubmit={handleCreateUser} className="space-y-4">
                      <div>
                        <label className="text-[10px] uppercase text-gray-500 font-mono block mb-1">Full Name</label>
                        <input 
                          type="text" 
                          placeholder="e.g. Sarah Connor"
                          value={createName}
                          onChange={(e) => setCreateName(e.target.value)}
                          className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-xs focus:outline-none focus:border-purple-500 text-white"
                          required
                        />
                      </div>

                      <div>
                        <label className="text-[10px] uppercase text-gray-500 font-mono block mb-1">Email Address</label>
                        <input 
                          type="email" 
                          placeholder="sarah@visionsupport.ai"
                          value={createEmail}
                          onChange={(e) => setCreateEmail(e.target.value)}
                          className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-xs focus:outline-none focus:border-purple-500 text-white font-mono"
                          required
                        />
                      </div>

                      <div>
                        <label className="text-[10px] uppercase text-gray-500 font-mono block mb-1">Secure Password</label>
                        <input 
                          type="password" 
                          placeholder="Min 8 characters"
                          value={createPassword}
                          onChange={(e) => setCreatePassword(e.target.value)}
                          className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-xs focus:outline-none focus:border-purple-500 text-white"
                          required
                        />
                      </div>

                      <div>
                        <label className="text-[10px] uppercase text-gray-500 font-mono block mb-1">System Role</label>
                        <select 
                          value={createRole} 
                          onChange={(e: any) => setCreateRole(e.target.value)}
                          className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-xs focus:outline-none focus:border-purple-500 text-purple-400 cursor-pointer"
                        >
                          <option value="agent">Support Agent</option>
                          <option value="supervisor">Supervisor</option>
                          <option value="observer">Observer (Watch-Only)</option>
                        </select>
                      </div>

                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 rounded-lg font-bold text-xs transition"
                      >
                        {loading ? 'Creating account...' : 'Create Account'}
                      </button>
                    </form>
                  </div>

                  {/* Reset Password Form */}
                  {selectedUserId && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="p-6 bg-white/5 border border-white/10 rounded-2xl glass-panel relative"
                    >
                      <button 
                        onClick={() => setSelectedUserId('')} 
                        className="absolute right-3 top-3 text-gray-500 hover:text-white text-xs font-mono font-bold"
                      >
                        ✕
                      </button>
                      <h3 className="text-md font-bold font-cyber text-yellow-500 flex items-center gap-2 mb-4">
                        <Key size={15} /> Reset Agent Key
                      </h3>

                      <form onSubmit={handleResetPassword} className="space-y-4">
                        <div>
                          <label className="text-[10px] uppercase text-gray-500 font-mono block mb-1">New password</label>
                          <input 
                            type="password" 
                            placeholder="Enter new credentials password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-xs focus:outline-none focus:border-purple-500 text-white"
                            required
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={loading}
                          className="w-full py-2.5 bg-yellow-600 hover:bg-yellow-700 text-white font-bold rounded-lg text-xs transition"
                        >
                          Update Password
                        </button>
                      </form>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'audits' && (
              <motion.div 
                key="audits"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="p-6 bg-white/5 border border-white/10 rounded-2xl glass-panel min-h-[50vh] flex flex-col"
              >
                <h3 className="text-lg font-bold font-cyber text-purple-400 flex items-center gap-2 mb-6">
                  <Terminal size={16} /> Security Audit Registry
                </h3>

                <div className="flex-1 overflow-y-auto max-h-[60vh] space-y-2 pr-1">
                  {auditLogs.map((log) => (
                    <div key={log._id} className="p-3.5 bg-black/45 border border-white/5 rounded-xl flex items-center justify-between text-xs font-mono">
                      <div className="flex items-center space-x-3 overflow-hidden">
                        {log.status === 'success' ? (
                          <Shield className="w-4 h-4 text-green-500 flex-shrink-0" />
                        ) : (
                          <ShieldAlert className="w-4 h-4 text-red-500 flex-shrink-0" />
                        )}
                        <div className="overflow-hidden">
                          <p className="font-bold text-gray-300 uppercase tracking-wide">{log.action}</p>
                          <p className="text-[10px] text-purple-400 mt-0.5">Operator: {log.userName} ({log.userRole}) • IP: {log.ipAddress}</p>
                          {log.details && (
                            <p className="text-[9px] text-gray-500 mt-1 select-all">Data payload: {JSON.stringify(log.details)}</p>
                          )}
                        </div>
                      </div>
                      <span className="text-[10px] text-gray-500 text-right shrink-0">{new Date(log.timestamp).toLocaleString()}</span>
                    </div>
                  ))}
                  {auditLogs.length === 0 && (
                    <p className="text-center text-gray-500 text-sm mt-8">No system actions registered.</p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
