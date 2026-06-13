import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { User } from '../models/User';
import { AuditLog } from '../models/AuditLog';
import { generate2FASecret, verify2FACode } from '../services/security';
import { requireAgent } from '../middleware/auth';

const router = express.Router();

const ACCESS_TOKEN_EXPIRY = '15m'; // Short-lived access tokens
const REFRESH_TOKEN_EXPIRY = '7d';

// Ensure uploads folder exists
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Multer configurations for profile photo upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `profile_${Date.now()}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Max 5MB
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|webp/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only image files (jpg, jpeg, png, webp) are allowed'));
  }
});

// Helper to generate tokens
const generateTokens = (user: any, deviceSessionId?: string) => {
  const accessToken = jwt.sign(
    { id: user._id, email: user.email, role: user.role, name: user.name, deviceSessionId },
    process.env.JWT_SECRET || 'visionsupport_jwt_secret_default',
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
  
  const refreshToken = jwt.sign(
    { id: user._id, deviceSessionId },
    process.env.JWT_SECRET || 'visionsupport_jwt_secret_default',
    { expiresIn: REFRESH_TOKEN_EXPIRY }
  );

  return { accessToken, refreshToken };
};

// Seed default agent if not exists
const seedDefaultAgent = async () => {
  try {
    const existing = await User.findOne({ email: 'agent@visionsupport.ai' });
    if (!existing) {
      const passwordHash = await bcrypt.hash('admin123', 10);
      const newAgent = new User({
        email: 'agent@visionsupport.ai',
        passwordHash,
        role: 'agent',
        name: 'Lead Support Agent',
        companyName: 'VisionSupport Corp',
        emailVerified: true,
        twoFactorEnabled: false
      });
      await newAgent.save();
      console.log('Default Agent seeded successfully: agent@visionsupport.ai / admin123');
    }
  } catch (err) {
    console.error('Seeding agent failed:', err);
  }
};
seedDefaultAgent();

// GET CSRF Token
router.get('/csrf-token', (req, res) => {
  const csrfToken = jwt.sign(
    { type: 'csrf', random: crypto.randomBytes(16).toString('hex') },
    process.env.JWT_SECRET || 'visionsupport_jwt_secret_default',
    { expiresIn: '1h' }
  );
  res.json({ csrfToken });
});

// Agent Registration
router.post('/register', async (req, res) => {
  try {
    const { email, password, confirmPassword, name, companyName } = req.body;
    if (!email || !password || !confirmPassword || !name || !companyName) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const verificationToken = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP

    const newUser = new User({
      email,
      passwordHash,
      role: 'agent',
      name,
      companyName,
      emailVerified: false,
      emailVerificationToken: verificationToken,
      emailVerificationExpires: new Date(Date.now() + 24 * 3600 * 1000) // 24 hours
    });

    await newUser.save();

    console.log(`========================================`);
    console.log(`EMAIL VERIFICATION CODE FOR: ${email}`);
    console.log(`CODE: ${verificationToken}`);
    console.log(`========================================`);
    
    res.status(201).json({
      success: true,
      email: newUser.email,
      message: 'Registration successful! Verification code logged to console.',
      verificationToken // Expose in response for simplified local verification/testing
    });
  } catch (error) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Verify Email
router.post('/verify-email', async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ error: 'Email and verification code are required' });
    }

    const user = await User.findOne({
      email,
      emailVerificationToken: code,
      emailVerificationExpires: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired verification code' });
    }

    user.emailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    res.json({ success: true, message: 'Email verified successfully! You may now log in.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to verify email' });
  }
});

// Forgot Password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const resetToken = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit code
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = new Date(Date.now() + 3600000); // 1 hour
    await user.save();

    console.log(`========================================`);
    console.log(`PASSWORD RESET CODE FOR: ${email}`);
    console.log(`CODE: ${resetToken}`);
    console.log(`========================================`);

    res.json({
      success: true,
      message: 'Password reset code logged to console.',
      token: resetToken // Expose code for easy developer workflow
    });
  } catch (error) {
    res.status(500).json({ error: 'Forgot password request failed' });
  }
});

// Reset Password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password, confirmPassword } = req.body;
    if (!token || !password || !confirmPassword) {
      return res.status(400).json({ error: 'Missing token or password fields' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired password reset token' });
    }

    user.passwordHash = await bcrypt.hash(password, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    
    // Clear lockouts
    user.loginAttempts = 0;
    user.lockUntil = undefined;
    await user.save();

    await AuditLog.create({
      userId: user._id.toString(),
      userName: user.name,
      userRole: user.role,
      action: 'password_reset_code',
      status: 'success',
      ipAddress: req.ip || '',
    });

    res.json({ success: true, message: 'Password reset successfully! Please login.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const ipAddress = req.ip || '';

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // 1. Account Lockout Check
    if (user.lockUntil && user.lockUntil > new Date()) {
      const remainingMin = Math.ceil((user.lockUntil.getTime() - Date.now()) / 60000);
      return res.status(403).json({ error: `Account locked due to consecutive failures. Try again in ${remainingMin} minutes.` });
    }

    // 2. Email Verification Check
    if (!user.emailVerified) {
      return res.status(403).json({ error: 'Please verify your email address before logging in.' });
    }

    // 3. Status/Disabled Check
    if (user.disabled) {
      return res.status(403).json({ error: 'Your account has been disabled. Please contact system administrators.' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      user.loginAttempts = (user.loginAttempts || 0) + 1;
      if (user.loginAttempts >= 5) {
        user.lockUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 mins lock
      }
      await user.save();

      await AuditLog.create({
        userId: 'unknown',
        userName: email,
        userRole: 'guest',
        action: 'login_attempt',
        status: 'failure',
        ipAddress,
        details: { reason: 'Password mismatch', attempts: user.loginAttempts }
      });
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Reset lockout counters on success
    user.loginAttempts = 0;
    user.lockUntil = undefined;
    await user.save();

    // Check if 2FA is required
    if (user.twoFactorEnabled) {
      const tfaToken = jwt.sign(
        { id: user._id, tfaRequired: true },
        process.env.JWT_SECRET || 'visionsupport_jwt_secret_default',
        { expiresIn: '5m' }
      );
      
      return res.json({
        twoFactorRequired: true,
        twoFactorToken: tfaToken,
      });
    }

    // Direct Login Session creation
    const deviceSessionId = uuidv4();
    user.deviceSessions.push({
      sessionId: deviceSessionId,
      userAgent: req.headers['user-agent'] || 'unknown',
      ipAddress,
      loginTime: new Date(),
      lastActive: new Date()
    });

    const { accessToken, refreshToken } = generateTokens(user, deviceSessionId);
    user.refreshToken = refreshToken;
    await user.save();

    await AuditLog.create({
      userId: user._id.toString(),
      userName: user.name,
      userRole: user.role,
      action: 'login_attempt',
      status: 'success',
      ipAddress,
      details: { sessionId: deviceSessionId }
    });

    res.json({
      accessToken,
      refreshToken,
      role: user.role,
      name: user.name,
      email: user.email,
      companyName: user.companyName,
      profilePhoto: user.profilePhoto,
      language: user.language,
      darkMode: user.darkMode,
      notificationPreferences: user.notificationPreferences
    });
  } catch (error) {
    res.status(500).json({ error: 'Login endpoint error' });
  }
});

// Setup 2FA secret
router.post('/2fa/setup', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { secret, qrCodeUrl } = await generate2FASecret(user.email);
    user.twoFactorSecret = secret;
    await user.save();

    res.json({ secret, qrCodeUrl });
  } catch (error) {
    res.status(500).json({ error: 'Failed to configure 2FA' });
  }
});

// Verify and enable 2FA
router.post('/2fa/enable', async (req, res) => {
  try {
    const { email, code } = req.body;
    const user = await User.findOne({ email });
    if (!user || !user.twoFactorSecret) {
      return res.status(400).json({ error: '2FA setup was not initialized' });
    }

    const isValid = verify2FACode(user.twoFactorSecret, code);
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    user.twoFactorEnabled = true;
    await user.save();

    await AuditLog.create({
      userId: user._id.toString(),
      userName: user.name,
      userRole: user.role,
      action: '2fa_enabled',
      status: 'success',
      details: { email }
    });

    res.json({ success: true, message: 'Two-factor authentication enabled successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to verify 2FA' });
  }
});

// Verify 2FA challenge during login
router.post('/2fa/verify-login', async (req, res) => {
  try {
    const { twoFactorToken, code } = req.body;
    const ipAddress = req.ip || '';
    
    if (!twoFactorToken || !code) {
      return res.status(400).json({ error: 'Token and verification code are required' });
    }

    let payload: any;
    try {
      payload = jwt.verify(twoFactorToken, process.env.JWT_SECRET || 'visionsupport_jwt_secret_default');
    } catch (err) {
      return res.status(401).json({ error: '2FA session expired. Please re-login.' });
    }

    if (!payload.tfaRequired) {
      return res.status(400).json({ error: 'Invalid 2FA transaction' });
    }

    const user = await User.findById(payload.id);
    if (!user || !user.twoFactorSecret) {
      return res.status(400).json({ error: 'User 2FA details missing' });
    }

    const isValid = verify2FACode(user.twoFactorSecret, code);
    if (!isValid) {
      await AuditLog.create({
        userId: user._id.toString(),
        userName: user.name,
        userRole: user.role,
        action: '2fa_login_verify',
        status: 'failure',
        ipAddress,
        details: { reason: 'Incorrect code' }
      });
      return res.status(401).json({ error: 'Invalid verification code' });
    }

    // Device Session registration
    const deviceSessionId = uuidv4();
    user.deviceSessions.push({
      sessionId: deviceSessionId,
      userAgent: req.headers['user-agent'] || 'unknown',
      ipAddress,
      loginTime: new Date(),
      lastActive: new Date()
    });

    const { accessToken, refreshToken } = generateTokens(user, deviceSessionId);
    user.refreshToken = refreshToken;
    await user.save();

    await AuditLog.create({
      userId: user._id.toString(),
      userName: user.name,
      userRole: user.role,
      action: '2fa_login_verify',
      status: 'success',
      ipAddress,
      details: { sessionId: deviceSessionId }
    });

    res.json({
      accessToken,
      refreshToken,
      role: user.role,
      name: user.name,
      email: user.email,
      companyName: user.companyName,
      profilePhoto: user.profilePhoto,
      language: user.language,
      darkMode: user.darkMode,
      notificationPreferences: user.notificationPreferences
    });
  } catch (error) {
    res.status(500).json({ error: '2FA verification exception' });
  }
});

// Profile Management routes
router.put('/profile', requireAgent, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { companyName, language, darkMode, notificationPreferences } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (companyName !== undefined) user.companyName = companyName;
    if (language !== undefined) user.language = language;
    if (darkMode !== undefined) user.darkMode = darkMode;
    if (notificationPreferences !== undefined) user.notificationPreferences = notificationPreferences;

    await user.save();

    res.json({
      success: true,
      user: {
        email: user.email,
        name: user.name,
        role: user.role,
        companyName: user.companyName,
        profilePhoto: user.profilePhoto,
        language: user.language,
        darkMode: user.darkMode,
        notificationPreferences: user.notificationPreferences
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Profile photo upload
router.post('/profile/photo', requireAgent, upload.single('photo'), async (req, res) => {
  try {
    const userId = (req as any).user.id;
    if (!req.file) {
      return res.status(400).json({ error: 'Please provide an image photo file' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Dynamic web URL path
    const host = process.env.API_URL || `${req.protocol}://${req.get('host')}`;
    const photoUrl = `${host}/api/uploads/${req.file.filename}`;
    user.profilePhoto = photoUrl;
    await user.save();

    res.json({ success: true, photoUrl });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to upload profile photo' });
  }
});

// Change Password
router.put('/change-password', requireAgent, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ error: 'All password fields are required' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'New passwords do not match' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Incorrect current password' });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();

    await AuditLog.create({
      userId: user._id.toString(),
      userName: user.name,
      userRole: user.role,
      action: 'password_changed',
      status: 'success',
      ipAddress: req.ip || '',
    });

    res.json({ success: true, message: 'Password changed successfully!' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// Get Active Device Sessions
router.get('/sessions', requireAgent, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user.deviceSessions || []);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve active device sessions' });
  }
});

// Revoke specific device session
router.post('/sessions/logout', requireAgent, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Filter out target session
    user.deviceSessions = (user.deviceSessions || []).filter(s => s.sessionId !== sessionId) as any;
    await user.save();

    await AuditLog.create({
      userId: user._id.toString(),
      userName: user.name,
      userRole: user.role,
      action: 'session_terminated',
      status: 'success',
      details: { terminatedSessionId: sessionId }
    });

    res.json({ success: true, message: 'Device session terminated' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to revoke device session' });
  }
});

// Active Session Logout (Revoke current session)
router.post('/logout', requireAgent, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const currentDeviceSessionId = (req as any).user.deviceSessionId;

    const user = await User.findById(userId);
    if (user && currentDeviceSessionId) {
      user.deviceSessions = (user.deviceSessions || []).filter(s => s.sessionId !== currentDeviceSessionId) as any;
      user.refreshToken = undefined;
      await user.save();

      await AuditLog.create({
        userId: user._id.toString(),
        userName: user.name,
        userRole: user.role,
        action: 'logout',
        status: 'success',
        details: { sessionId: currentDeviceSessionId }
      });
    }

    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to logout session' });
  }
});

// Token Refresh
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token is required' });
    }

    let decoded: any;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_SECRET || 'visionsupport_jwt_secret_default');
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    const user = await User.findOne({ _id: decoded.id, refreshToken });
    if (!user) {
      return res.status(401).json({ error: 'User session not found' });
    }

    // Verify session ID matches active session in MongoDB
    const hasActiveSession = (user.deviceSessions || []).some(s => s.sessionId === decoded.deviceSessionId);
    if (!hasActiveSession) {
      return res.status(401).json({ error: 'Session has been revoked or logged out.' });
    }

    // Generate new access token signed with current deviceSessionId
    const newAccessToken = jwt.sign(
      { id: user._id, email: user.email, role: user.role, name: user.name, deviceSessionId: decoded.deviceSessionId },
      process.env.JWT_SECRET || 'visionsupport_jwt_secret_default',
      { expiresIn: ACCESS_TOKEN_EXPIRY }
    );

    res.json({ accessToken: newAccessToken });
  } catch (error) {
    res.status(500).json({ error: 'Refresh token endpoint error' });
  }
});

export default router;
