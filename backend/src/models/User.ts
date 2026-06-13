import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['agent', 'customer', 'supervisor', 'observer'], default: 'customer' },
  name: { type: String, required: true },
  companyName: { type: String },
  profilePhoto: { type: String }, // Base64 or local filename path
  language: { type: String, default: 'en' },
  darkMode: { type: Boolean, default: true },
  notificationPreferences: {
    email: { type: Boolean, default: true },
    push: { type: Boolean, default: true }
  },

  // Account security statuses
  disabled: { type: Boolean, default: false },
  loginAttempts: { type: Number, default: 0 },
  lockUntil: { type: Date },

  // Email verification logic
  emailVerified: { type: Boolean, default: false },
  emailVerificationToken: { type: String },
  emailVerificationExpires: { type: Date },

  // Password resets
  resetPasswordToken: { type: String },
  resetPasswordExpires: { type: Date },

  // Device session management
  deviceSessions: [{
    sessionId: { type: String, required: true },
    userAgent: { type: String },
    ipAddress: { type: String },
    loginTime: { type: Date, default: Date.now },
    lastActive: { type: Date, default: Date.now }
  }],
  
  // 2FA variables
  twoFactorEnabled: { type: Boolean, default: false },
  twoFactorSecret: { type: String },
  
  // Token authentication
  refreshToken: { type: String },
  createdAt: { type: Date, default: Date.now }
});

export const User = mongoose.model('User', userSchema);

