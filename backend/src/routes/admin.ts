import express from 'express';
import bcrypt from 'bcryptjs';
import { requireAgent } from '../middleware/auth';
import { Session } from '../models/Session';
import { Participant } from '../models/Participant';
import { AuditLog } from '../models/AuditLog';
import { User } from '../models/User';
import { getLiveSystemTelemetry } from '../services/metrics';

const router = express.Router();

// Live Telemetry (CPU, memory, active count) - Agent/Supervisor only
router.get('/metrics', requireAgent, async (req, res) => {
  try {
    const stats = getLiveSystemTelemetry();
    const activeCount = await Session.countDocuments({ status: 'active' });
    const activeParticipants = await Participant.countDocuments({ status: 'connected' });
    
    res.json({
      ...stats,
      activeSessions: activeCount,
      activeUsers: activeParticipants
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch telemetry metrics' });
  }
});

// List Live Sessions (Agent/Supervisor only)
router.get('/sessions/live', requireAgent, async (req, res) => {
  try {
    const sessions = await Session.find({ status: 'active' }).sort({ createdAt: -1 });
    const liveSessions = [];

    for (const session of sessions) {
      const participants = await Participant.find({ sessionId: session.sessionId, status: 'connected' });
      liveSessions.push({
        _id: session._id,
        sessionId: session.sessionId,
        createdAt: session.createdAt,
        agentId: session.agentId,
        inviteToken: session.inviteToken,
        participants: participants.map(p => ({
          userId: p.userId,
          name: p.name,
          role: p.role,
          joinTime: p.joinTime,
          latency: p.latency,
          packetLoss: p.packetLoss,
          bitrate: p.bitrate
        }))
      });
    }

    res.json(liveSessions);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch live sessions' });
  }
});

// Force actions: Terminate call
router.post('/sessions/terminate', requireAgent, async (req, res) => {
  try {
    const { sessionId } = req.body;
    const session = await Session.findOne({ sessionId });
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    session.status = 'ended';
    session.endedAt = new Date();
    await session.save();

    // Force disconnect participants in DB
    await Participant.updateMany({ sessionId, status: 'connected' }, { status: 'disconnected', leaveTime: new Date() });

    await AuditLog.create({
      userId: (req as any).user.id,
      userName: (req as any).user.name,
      userRole: (req as any).user.role,
      action: 'force_terminate_session',
      status: 'success',
      details: { sessionId }
    });

    res.json({ success: true, message: 'Session terminated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to terminate session' });
  }
});

// Force actions: Disconnect a specific participant
router.post('/participants/disconnect', requireAgent, async (req, res) => {
  try {
    const { sessionId, userId } = req.body;
    
    const participant = await Participant.findOne({ sessionId, userId, status: 'connected' });
    if (!participant) {
      return res.status(404).json({ error: 'Connected participant not found' });
    }

    participant.status = 'disconnected';
    participant.leaveTime = new Date();
    await participant.save();

    await AuditLog.create({
      userId: (req as any).user.id,
      userName: (req as any).user.name,
      userRole: (req as any).user.role,
      action: 'force_disconnect_participant',
      status: 'success',
      details: { sessionId, targetUserId: userId, targetName: participant.name }
    });

    res.json({ success: true, message: `Participant ${participant.name} disconnected` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to disconnect participant' });
  }
});

// Fetch Security Audit Logs
router.get('/audit-logs', requireAgent, async (req, res) => {
  try {
    const logs = await AuditLog.find().sort({ timestamp: -1 }).limit(200);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch security audit logs' });
  }
});

// Aggregated Analytics Summary
router.get('/analytics/summary', requireAgent, async (req, res) => {
  try {
    const totalSessions = await Session.countDocuments();
    const endedSessions = await Session.find({ status: 'ended' });
    
    let sumDuration = 0;
    endedSessions.forEach(s => {
      if (s.endedAt) {
        sumDuration += Math.round((s.endedAt.getTime() - s.createdAt.getTime()) / 1000);
      }
    });
    
    const avgDuration = totalSessions > 0 ? Math.round(sumDuration / totalSessions) : 0;
    
    // Simulate resolution success rate and CSAT for analytics dashboard
    const resolutionRate = 88; // 88% success rate
    const csatScore = 4.7; // 4.7 out of 5 stars

    res.json({
      totalSessions,
      activeSessions: await Session.countDocuments({ status: 'active' }),
      avgDuration,
      resolutionRate,
      csatScore
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to compile analytics summary' });
  }
});

// Admin: List all Users
router.get('/users', requireAgent, async (req, res) => {
  try {
    const users = await User.find({}, '-passwordHash -twoFactorSecret -refreshToken');
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user directory' });
  }
});

// Admin: Create New Agent/User
router.post('/users/create', requireAgent, async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'Missing name, email, password, or role' });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = new User({
      name,
      email,
      passwordHash,
      role,
      twoFactorEnabled: false
    });
    await newUser.save();

    await AuditLog.create({
      userId: (req as any).user.id,
      userName: (req as any).user.name,
      userRole: (req as any).user.role,
      action: 'admin_create_user',
      status: 'success',
      details: { createdUserEmail: email, createdUserRole: role }
    });

    res.status(201).json({ success: true, user: { _id: newUser._id, name: newUser.name, email: newUser.email, role: newUser.role } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create new user' });
  }
});

// Admin: Reset User Password
router.post('/users/reset-password', requireAgent, async (req, res) => {
  try {
    const { userId, newPassword } = req.body;
    if (!userId || !newPassword) {
      return res.status(400).json({ error: 'Missing userId or newPassword' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();

    await AuditLog.create({
      userId: (req as any).user.id,
      userName: (req as any).user.name,
      userRole: (req as any).user.role,
      action: 'admin_reset_password',
      status: 'success',
      details: { targetUserEmail: user.email }
    });

    res.json({ success: true, message: `Password reset successfully for ${user.email}` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reset user password' });
  }
});

// Admin: Update User Role
router.post('/users/update-role', requireAgent, async (req, res) => {
  try {
    const { userId, role } = req.body;
    if (!userId || !role) {
      return res.status(400).json({ error: 'Missing userId or role' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const oldRole = user.role;
    user.role = role;
    await user.save();

    await AuditLog.create({
      userId: (req as any).user.id,
      userName: (req as any).user.name,
      userRole: (req as any).user.role,
      action: 'admin_update_role',
      status: 'success',
      details: { targetUserEmail: user.email, oldRole, newRole: role }
    });

    res.json({ success: true, message: `Role updated to ${role} for ${user.email}` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

// Admin: Toggle 2FA on User
router.post('/users/toggle-2fa', requireAgent, async (req, res) => {
  try {
    const { userId, twoFactorEnabled } = req.body;
    if (!userId || twoFactorEnabled === undefined) {
      return res.status(400).json({ error: 'Missing userId or twoFactorEnabled state' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.twoFactorEnabled = twoFactorEnabled;
    // Clear secret if disabling
    if (!twoFactorEnabled) {
      user.twoFactorSecret = undefined;
    }
    await user.save();

    await AuditLog.create({
      userId: (req as any).user.id,
      userName: (req as any).user.name,
      userRole: (req as any).user.role,
      action: 'admin_toggle_2fa',
      status: 'success',
      details: { targetUserEmail: user.email, twoFactorEnabled }
    });

    res.json({ success: true, message: `2FA ${twoFactorEnabled ? 'enabled' : 'disabled'} for ${user.email}` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to toggle 2FA for user' });
  }
});

// Admin: Toggle Disabled on User
router.post('/users/toggle-disabled', requireAgent, async (req, res) => {
  try {
    const { userId, disabled } = req.body;
    if (!userId || disabled === undefined) {
      return res.status(400).json({ error: 'Missing userId or disabled state' });
    }

    if (userId === (req as any).user.id) {
      return res.status(400).json({ error: 'Cannot disable your own administrative account' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.disabled = disabled;
    await user.save();

    await AuditLog.create({
      userId: (req as any).user.id,
      userName: (req as any).user.name,
      userRole: (req as any).user.role,
      action: 'admin_toggle_disabled',
      status: 'success',
      details: { targetUserEmail: user.email, disabled }
    });

    res.json({ success: true, message: `User ${user.email} status set to ${disabled ? 'Disabled' : 'Enabled'}` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to toggle user status' });
  }
});

export default router;
