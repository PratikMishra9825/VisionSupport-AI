"use client";
import { API_BASE, SOCKET_BASE } from '@/config';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/store/useStore';
import { motion, AnimatePresence } from 'framer-motion';
import ThreeBackground from '@/components/ThreeBackground';
import Logo3D from '@/components/Logo3D';
import { Lock, Mail, ShieldCheck, ArrowRight, User, Building, ShieldAlert, CheckCircle } from 'lucide-react';

export default function Login() {
  const [mode, setMode] = useState<'login' | 'register' | 'verify' | 'forgot' | 'reset'>('login');
  
  // Fields: Login
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  
  // Fields: Register
  const [regName, setRegName] = useState('');
  const [regCompany, setRegCompany] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');

  // Fields: Verify Email
  const [verifyEmail, setVerifyEmail] = useState('');
  const [verifyCode, setVerifyCode] = useState('');

  // Fields: Forgot Password
  const [forgotEmail, setForgotEmail] = useState('');

  // Fields: Reset Password
  const [resetToken, setResetToken] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');

  // 2FA state managers
  const [twoFactorRequired, setTwoFactorRequired] = useState(false);
  const [twoFactorToken, setTwoFactorToken] = useState('');
  const [otpCode, setOtpCode] = useState('');

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const setAuth = useStore((state) => state.setAuth);
  const setCsrfToken = useStore((state) => state.setCsrfToken);

  // Fetch CSRF Token on mount
  useEffect(() => {
    const fetchCsrf = async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/csrf-token`);
        const data = await res.json();
        if (res.ok) {
          setCsrfToken(data.csrfToken);
        }
      } catch (err) {
        console.error('Failed to handshake CSRF token', err);
      }
    };
    fetchCsrf();
  }, [setCsrfToken]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();
      setLoading(false);

      if (res.ok) {
        if (data.twoFactorRequired) {
          setTwoFactorRequired(true);
          setTwoFactorToken(data.twoFactorToken);
        } else {
          // Remember Me state persistence allocation
          if (rememberMe) {
            localStorage.setItem('vs_auth_token', data.accessToken);
            localStorage.setItem('vs_auth_role', data.role);
            localStorage.setItem('vs_auth_name', data.name);
            localStorage.setItem('vs_auth_email', data.email);
            localStorage.setItem('vs_auth_company', data.companyName || '');
            localStorage.setItem('vs_auth_photo', data.profilePhoto || '');
            localStorage.setItem('vs_auth_lang', data.language || 'en');
            localStorage.setItem('vs_auth_dark', String(data.darkMode !== false));
            localStorage.setItem('vs_auth_notif', JSON.stringify(data.notificationPreferences || { email: true, push: true }));
          } else {
            sessionStorage.setItem('vs_auth_token', data.accessToken);
            sessionStorage.setItem('vs_auth_role', data.role);
            sessionStorage.setItem('vs_auth_name', data.name);
            sessionStorage.setItem('vs_auth_email', data.email);
            sessionStorage.setItem('vs_auth_company', data.companyName || '');
            sessionStorage.setItem('vs_auth_photo', data.profilePhoto || '');
            sessionStorage.setItem('vs_auth_lang', data.language || 'en');
            sessionStorage.setItem('vs_auth_dark', String(data.darkMode !== false));
            sessionStorage.setItem('vs_auth_notif', JSON.stringify(data.notificationPreferences || { email: true, push: true }));
          }

          setAuth(
            data.accessToken, 
            data.role, 
            data.name, 
            data.email, 
            data.companyName, 
            data.profilePhoto, 
            data.language, 
            data.darkMode, 
            data.notificationPreferences
          );
          router.push('/dashboard');
        }
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (err) {
      setLoading(false);
      setError('Connection refused. Is backend server offline?');
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/auth/2fa/verify-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ twoFactorToken, code: otpCode })
      });

      const data = await res.json();
      setLoading(false);

      if (res.ok) {
        if (rememberMe) {
          localStorage.setItem('vs_auth_token', data.accessToken);
          localStorage.setItem('vs_auth_role', data.role);
          localStorage.setItem('vs_auth_name', data.name);
          localStorage.setItem('vs_auth_email', data.email);
          localStorage.setItem('vs_auth_company', data.companyName || '');
          localStorage.setItem('vs_auth_photo', data.profilePhoto || '');
          localStorage.setItem('vs_auth_lang', data.language || 'en');
          localStorage.setItem('vs_auth_dark', String(data.darkMode !== false));
          localStorage.setItem('vs_auth_notif', JSON.stringify(data.notificationPreferences || { email: true, push: true }));
        } else {
          sessionStorage.setItem('vs_auth_token', data.accessToken);
          sessionStorage.setItem('vs_auth_role', data.role);
          sessionStorage.setItem('vs_auth_name', data.name);
          sessionStorage.setItem('vs_auth_email', data.email);
          sessionStorage.setItem('vs_auth_company', data.companyName || '');
          sessionStorage.setItem('vs_auth_photo', data.profilePhoto || '');
          sessionStorage.setItem('vs_auth_lang', data.language || 'en');
          sessionStorage.setItem('vs_auth_dark', String(data.darkMode !== false));
          sessionStorage.setItem('vs_auth_notif', JSON.stringify(data.notificationPreferences || { email: true, push: true }));
        }

        setAuth(
          data.accessToken, 
          data.role, 
          data.name, 
          data.email, 
          data.companyName, 
          data.profilePhoto, 
          data.language, 
          data.darkMode, 
          data.notificationPreferences
        );
        router.push('/dashboard');
      } else {
        setError(data.error || 'Incorrect OTP code');
      }
    } catch (err) {
      setLoading(false);
      setError('Connection refused. OTP validation failed.');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    if (regPassword !== regConfirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: regName,
          companyName: regCompany,
          email: regEmail,
          password: regPassword,
          confirmPassword: regConfirmPassword
        })
      });

      const data = await res.json();
      setLoading(false);

      if (res.ok) {
        setMessage('Registration successful! Verification token printed in console.');
        setVerifyEmail(regEmail);
        // Pre-fill verification code for local ease of access
        if (data.verificationToken) {
          setVerifyCode(data.verificationToken);
        }
        setMode('verify');
      } else {
        setError(data.error || 'Registration failed');
      }
    } catch (err) {
      setLoading(false);
      setError('Connection refused. Registration offline.');
    }
  };

  const handleVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/auth/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: verifyEmail, code: verifyCode })
      });

      const data = await res.json();
      setLoading(false);

      if (res.ok) {
        setMessage('Email verified successfully! You may now log in.');
        setEmail(verifyEmail);
        setMode('login');
      } else {
        setError(data.error || 'Invalid or expired verification code');
      }
    } catch (err) {
      setLoading(false);
      setError('Connection refused. Verification check offline.');
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail })
      });

      const data = await res.json();
      setLoading(false);

      if (res.ok) {
        setMessage('Password reset token printed to console.');
        if (data.token) {
          setResetToken(data.token);
        }
        setMode('reset');
      } else {
        setError(data.error || 'Email address not found');
      }
    } catch (err) {
      setLoading(false);
      setError('Connection refused. Forgot password service offline.');
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    if (resetPassword !== resetConfirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: resetToken,
          password: resetPassword,
          confirmPassword: resetConfirmPassword
        })
      });

      const data = await res.json();
      setLoading(false);

      if (res.ok) {
        setMessage('Password reset successful! Please log in.');
        setMode('login');
      } else {
        setError(data.error || 'Failed to reset password');
      }
    } catch (err) {
      setLoading(false);
      setError('Connection refused. Password reset offline.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-black select-none">
      {/* 3D animated background */}
      <ThreeBackground />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="z-10 max-w-md w-full mx-4 my-8"
      >
        {/* Glass panel login container */}
        <div className="p-8 rounded-3xl border border-white/10 glass-panel shadow-2xl flex flex-col items-center">
          <Logo3D />
          <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-indigo-500 text-center tracking-wide font-cyber mb-1">
            VisionSupport AI
          </h2>
          <p className="text-xs text-gray-500 uppercase tracking-widest font-mono mb-6">Enterprise Control Center</p>

          {error && (
            <motion.p 
              initial={{ opacity: 0, y: -5 }} 
              animate={{ opacity: 1, y: 0 }} 
              className="text-red-400 text-xs font-mono mb-4 text-center p-2 bg-red-950/20 border border-red-500/20 rounded-lg w-full flex items-center justify-center gap-1"
            >
              <ShieldAlert size={14} /> {error}
            </motion.p>
          )}

          {message && (
            <motion.p 
              initial={{ opacity: 0, y: -5 }} 
              animate={{ opacity: 1, y: 0 }} 
              className="text-green-400 text-xs font-mono mb-4 text-center p-2 bg-green-950/20 border border-green-500/20 rounded-lg w-full flex items-center justify-center gap-1"
            >
              <CheckCircle size={14} /> {message}
            </motion.p>
          )}

          <AnimatePresence mode="wait">
            {twoFactorRequired ? (
              // Phase: 2FA OTP Form
              <motion.form
                key="otp-form"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onSubmit={handleVerifyOTP}
                className="w-full space-y-4"
              >
                <div className="text-center mb-2">
                  <p className="text-sm text-purple-400 font-semibold">Two-Factor Authentication Active</p>
                  <p className="text-xs text-gray-500 mt-1">Enter the 6-digit OTP code from your authenticator application.</p>
                </div>

                <div className="relative">
                  <ShieldCheck size={16} className="absolute left-3.5 top-3.5 text-purple-400" />
                  <input
                    type="text"
                    placeholder="000 000"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    className="w-full pl-11 pr-4 py-3.5 bg-black/40 border border-purple-500/20 rounded-xl text-center text-lg tracking-widest focus:outline-none focus:border-purple-500 text-white"
                    required
                  />
                </div>

                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.96 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 rounded-xl font-bold text-sm tracking-wider uppercase text-white shadow-lg shadow-purple-500/20 flex items-center justify-center gap-2 transition"
                >
                  {loading ? 'Verifying Code...' : 'Access Terminal'} <ArrowRight size={16} />
                </motion.button>
              </motion.form>
            ) : mode === 'login' ? (
              // Form: Login
              <motion.form
                key="login-form"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                onSubmit={handleLogin}
                className="w-full space-y-4"
              >
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-3.5 text-gray-500" />
                  <input
                    type="email"
                    placeholder="Email Address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-11 pr-4 py-3.5 bg-black/40 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-purple-500 text-white"
                    required
                  />
                </div>

                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-3.5 text-gray-500" />
                  <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-11 pr-4 py-3.5 bg-black/40 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-purple-500 text-white"
                    required
                  />
                </div>

                <div className="flex items-center justify-between text-xs text-gray-400 select-none pb-2">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="rounded border-white/10 bg-black/40 text-purple-600 focus:ring-0 focus:ring-offset-0"
                    />
                    <span>Remember Me</span>
                  </label>
                  <button 
                    type="button" 
                    onClick={() => { setError(''); setMessage(''); setMode('forgot'); }} 
                    className="hover:text-white transition"
                  >
                    Forgot Password?
                  </button>
                </div>

                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.96 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 hologram-btn rounded-xl font-bold text-sm tracking-wider uppercase text-white flex items-center justify-center gap-2"
                >
                  {loading ? 'Decrypting Access...' : 'Authenticate'} <ArrowRight size={16} />
                </motion.button>

                <p className="text-center text-xs text-gray-500 mt-4">
                  New operator?{' '}
                  <button 
                    type="button" 
                    onClick={() => { setError(''); setMessage(''); setMode('register'); }} 
                    className="text-purple-400 hover:text-white transition underline"
                  >
                    Register Account
                  </button>
                </p>
              </motion.form>
            ) : mode === 'register' ? (
              // Form: Register
              <motion.form
                key="register-form"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onSubmit={handleRegister}
                className="w-full space-y-4"
              >
                <div className="relative">
                  <User size={16} className="absolute left-3.5 top-3.5 text-gray-500" />
                  <input
                    type="text"
                    placeholder="Full Name"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    className="w-full pl-11 pr-4 py-3.5 bg-black/40 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-purple-500 text-white"
                    required
                  />
                </div>

                <div className="relative">
                  <Building size={16} className="absolute left-3.5 top-3.5 text-gray-500" />
                  <input
                    type="text"
                    placeholder="Company Name"
                    value={regCompany}
                    onChange={(e) => setRegCompany(e.target.value)}
                    className="w-full pl-11 pr-4 py-3.5 bg-black/40 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-purple-500 text-white"
                    required
                  />
                </div>

                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-3.5 text-gray-500" />
                  <input
                    type="email"
                    placeholder="Email Address"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    className="w-full pl-11 pr-4 py-3.5 bg-black/40 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-purple-500 text-white"
                    required
                  />
                </div>

                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-3.5 text-gray-500" />
                  <input
                    type="password"
                    placeholder="Password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    className="w-full pl-11 pr-4 py-3.5 bg-black/40 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-purple-500 text-white"
                    required
                  />
                </div>

                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-3.5 text-gray-500" />
                  <input
                    type="password"
                    placeholder="Confirm Password"
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    className="w-full pl-11 pr-4 py-3.5 bg-black/40 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-purple-500 text-white"
                    required
                  />
                </div>

                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.96 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 rounded-xl font-bold text-sm tracking-wider uppercase text-white transition flex items-center justify-center gap-2"
                >
                  {loading ? 'Creating Profile...' : 'Sign Up Operator'} <ArrowRight size={16} />
                </motion.button>

                <p className="text-center text-xs text-gray-500 mt-4">
                  Already registered?{' '}
                  <button 
                    type="button" 
                    onClick={() => { setError(''); setMessage(''); setMode('login'); }} 
                    className="text-purple-400 hover:text-white transition underline"
                  >
                    Login here
                  </button>
                </p>
              </motion.form>
            ) : mode === 'verify' ? (
              // Form: Verify Email
              <motion.form
                key="verify-form"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onSubmit={handleVerifyEmail}
                className="w-full space-y-4"
              >
                <div className="text-center mb-2">
                  <p className="text-sm text-purple-400 font-semibold">Verification Code Required</p>
                  <p className="text-xs text-gray-500 mt-1">We sent a 6-digit confirmation code to your registered email address.</p>
                </div>

                <div className="relative">
                  <ShieldCheck size={16} className="absolute left-3.5 top-3.5 text-purple-400" />
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="000 000"
                    value={verifyCode}
                    onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                    className="w-full pl-11 pr-4 py-3.5 bg-black/40 border border-purple-500/20 rounded-xl text-center text-lg tracking-widest focus:outline-none focus:border-purple-500 text-white"
                    required
                  />
                </div>

                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.96 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 rounded-xl font-bold text-sm tracking-wider uppercase text-white transition flex items-center justify-center gap-2"
                >
                  {loading ? 'Confirming Code...' : 'Verify Registration'} <ArrowRight size={16} />
                </motion.button>

                <motion.button 
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.96 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  type="button" 
                  onClick={() => { setError(''); setMessage(''); setMode('login'); }} 
                  className="w-full text-center text-xs text-gray-500 hover:text-white transition"
                >
                  ✕ Exit Verification
                </motion.button>
              </motion.form>
            ) : mode === 'forgot' ? (
              // Form: Forgot Password
              <motion.form
                key="forgot-form"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                onSubmit={handleForgot}
                className="w-full space-y-4"
              >
                <div className="text-center mb-2">
                  <p className="text-sm text-purple-400 font-semibold">Forgot Key Credentials?</p>
                  <p className="text-xs text-gray-500 mt-1">Enter your registered email address to receive password reset tokens.</p>
                </div>

                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-3.5 text-gray-500" />
                  <input
                    type="email"
                    placeholder="Email Address"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className="w-full pl-11 pr-4 py-3.5 bg-black/40 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-purple-500 text-white"
                    required
                  />
                </div>

                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.96 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 rounded-xl font-bold text-sm tracking-wider uppercase text-white transition flex items-center justify-center gap-2"
                >
                  {loading ? 'Generating Token...' : 'Generate Reset Token'} <ArrowRight size={16} />
                </motion.button>

                <motion.button 
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.96 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  type="button" 
                  onClick={() => { setError(''); setMessage(''); setMode('login'); }} 
                  className="w-full text-center text-xs text-gray-500 hover:text-white transition font-mono"
                >
                  ✕ Return to Login
                </motion.button>
              </motion.form>
            ) : (
              // Form: Reset Password
              <motion.form
                key="reset-form"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onSubmit={handleReset}
                className="w-full space-y-4"
              >
                <div className="text-center mb-2">
                  <p className="text-sm text-purple-400 font-semibold">Reset Operator Credentials</p>
                  <p className="text-xs text-gray-500 mt-1">Provide the reset token code logged to the console and your new password.</p>
                </div>

                <div className="relative">
                  <ShieldCheck size={16} className="absolute left-3.5 top-3.5 text-purple-400" />
                  <input
                    type="text"
                    placeholder="Reset Token (Code)"
                    value={resetToken}
                    onChange={(e) => setResetToken(e.target.value)}
                    className="w-full pl-11 pr-4 py-3.5 bg-black/40 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-purple-500 text-white font-mono text-center"
                    required
                  />
                </div>

                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-3.5 text-gray-500" />
                  <input
                    type="password"
                    placeholder="New Secure Password"
                    value={resetPassword}
                    onChange={(e) => setResetPassword(e.target.value)}
                    className="w-full pl-11 pr-4 py-3.5 bg-black/40 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-purple-500 text-white"
                    required
                  />
                </div>

                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-3.5 text-gray-500" />
                  <input
                    type="password"
                    placeholder="Confirm New Password"
                    value={resetConfirmPassword}
                    onChange={(e) => setResetConfirmPassword(e.target.value)}
                    className="w-full pl-11 pr-4 py-3.5 bg-black/40 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-purple-500 text-white"
                    required
                  />
                </div>

                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.96 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 bg-gradient-to-r from-yellow-600 to-amber-600 hover:from-yellow-700 hover:to-amber-700 rounded-xl font-bold text-sm tracking-wider uppercase text-white transition flex items-center justify-center gap-2"
                >
                  {loading ? 'Updating Credentials...' : 'Save New Password'} <ArrowRight size={16} />
                </motion.button>

                <motion.button 
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.96 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  type="button" 
                  onClick={() => { setError(''); setMessage(''); setMode('login'); }} 
                  className="w-full text-center text-xs text-gray-500 hover:text-white transition font-mono"
                >
                  ✕ Return to Login
                </motion.button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
