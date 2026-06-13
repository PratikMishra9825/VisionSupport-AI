import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Session } from '../models/Session';
import { EventLog } from '../models/EventLog';
import { Participant } from '../models/Participant';
import { requireAgent } from '../middleware/auth';
import { createRoomRouter } from '../mediasoup';
import { startRecording, pauseRecording, resumeRecording, stopRecording } from '../services/recording';
import { Recording } from '../models/Recording';
import { Notification } from '../models/Notification';
import { File } from '../models/File';
import { Ticket } from '../models/Ticket';

const router = express.Router();

// Create Session (Agent/Supervisor Only)
router.post('/create', requireAgent, async (req, res) => {
  try {
    const sessionId = uuidv4();
    const inviteToken = uuidv4();
    const portalToken = uuidv4();
    const agentId = (req as any).user.id;
    const agentName = (req as any).user.name;

    const newSession = new Session({
      sessionId,
      agentId,
      inviteToken,
      portalToken,
      status: 'active'
    });

    await newSession.save();

    await EventLog.create({
      sessionId,
      event: 'session_created',
      details: { agentId, agentName }
    });

    res.json({
      sessionId,
      inviteToken,
      portalToken,
      inviteLink: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/join/${inviteToken}`
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// Join Session verification
router.post('/join', async (req, res) => {
  try {
    const { inviteToken, role, name } = req.body;
    
    if (!inviteToken) {
      return res.status(400).json({ error: 'Invite token is required' });
    }

    const session = await Session.findOne({ inviteToken, status: 'active' });
    if (!session) {
      return res.status(404).json({ error: 'Session not found or already ended' });
    }

    const joinRole = role || 'customer';
    const joinName = name || 'Anonymous Guest';

    // Register customer/observer/supervisor joining
    session.participants.push({
      role: joinRole,
      joinTime: new Date()
    });
    await session.save();

    await EventLog.create({
      sessionId: session.sessionId,
      event: 'participant_joined',
      details: { role: joinRole, name: joinName }
    });

    res.json({
      sessionId: session.sessionId,
      status: session.status,
      role: joinRole,
      name: joinName,
      portalToken: session.portalToken
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to join session' });
  }
});

// End Session (Agent/Supervisor Only)
router.post('/end', requireAgent, async (req, res) => {
  try {
    const { sessionId } = req.body;
    const session = await Session.findOne({ sessionId });
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    session.status = 'ended';
    session.endedAt = new Date();
    
    // Calculate resolution duration in seconds
    session.resolutionDuration = Math.round((session.endedAt.getTime() - session.createdAt.getTime()) / 1000);
    
    // Calculate response time in seconds
    const customerPart = await Participant.findOne({ sessionId, role: 'customer' });
    const agentPart = await Participant.findOne({ sessionId, role: 'agent' });
    if (customerPart && agentPart) {
      session.responseTime = Math.max(0, Math.round((agentPart.joinTime.getTime() - customerPart.joinTime.getTime()) / 1000));
    } else {
      session.responseTime = 45; // Fallback
    }

    await session.save();

    // Mark all connected participants as disconnected
    await Participant.updateMany({ sessionId, status: 'connected' }, { status: 'disconnected', leaveTime: new Date() });

    await EventLog.create({
      sessionId,
      event: 'session_ended'
    });

    const io = req.app.get('io');
    if (io) {
      io.to(sessionId).emit('session-ended', { sessionId });
    }

    res.json({ success: true, sessionId, portalToken: session.portalToken });
  } catch (error) {
    res.status(500).json({ error: 'Failed to end session' });
  }
});

// Get Session logs & events timeline
router.get('/:sessionId/logs', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const logs = await EventLog.find({ sessionId }).sort({ timestamp: 1 });
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch session event logs' });
  }
});

// Get Session History (Agent Only)
router.get('/history', requireAgent, async (req, res) => {
  try {
    const sessions = await Session.find().sort({ createdAt: -1 });
    res.json(sessions);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// Recording REST APIs
router.post('/record/start', requireAgent, async (req, res) => {
  try {
    const { sessionId, producers } = req.body;
    const routerInstance = await createRoomRouter(sessionId);
    
    // Producers are payload of [{producerId: "...", kind: "audio/video"}]
    const recordingId = await startRecording(routerInstance, sessionId, (producers || []) as Array<{ producerId: string; kind: 'audio' | 'video' }>);
    
    // Fetch active participants to store their names in the recording metadata
    const activeParticipants = await Participant.find({ sessionId, status: 'connected' });
    const participantsList = activeParticipants.map(p => ({ name: p.name, role: p.role }));

    const recDoc = new Recording({
      sessionId,
      recordingId,
      status: 'recording',
      participants: participantsList,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 Days retention
    });
    await recDoc.save();

    await EventLog.create({
      sessionId,
      event: 'recording_started',
      details: { recordingId, startedBy: (req as any).user.name }
    });

    res.json({ success: true, recordingId });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to start recording' });
  }
});

router.post('/record/pause', requireAgent, async (req, res) => {
  try {
    const { sessionId } = req.body;
    await pauseRecording(sessionId);
    
    await Recording.findOneAndUpdate({ sessionId, status: 'recording' }, { status: 'recording' }); // update
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to pause recording' });
  }
});

router.post('/record/resume', requireAgent, async (req, res) => {
  try {
    const { sessionId } = req.body;
    await resumeRecording(sessionId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to resume recording' });
  }
});

router.post('/record/stop', requireAgent, async (req, res) => {
  try {
    const { sessionId } = req.body;
    const result = await stopRecording(sessionId);
    
    // Update recording doc with minio keys and status
    const recDoc = await Recording.findOneAndUpdate(
      { sessionId, recordingId: result.recordingId },
      {
        status: 'ready',
        videoUrl: result.videoUrl,
        thumbnailUrl: result.thumbnailUrl,
        duration: result.duration,
        markers: result.markers
      },
      { new: true }
    );

    await EventLog.create({
      sessionId,
      event: 'recording_stopped',
      details: { recordingId: result.recordingId, stoppedBy: (req as any).user.name, duration: result.duration }
    });

    const notification = new Notification({
      agentId: (req as any).user.id,
      title: 'Recording Completion',
      body: `Support session recording for room ${sessionId.substring(0, 8)} is ready.`,
      type: 'recording_ready'
    });
    await notification.save();

    const io = req.app.get('io');
    if (io) {
      io.to('agents-notifications').emit('agent-notification', notification);
    }

    res.json({ success: true, recording: recDoc });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to stop recording' });
  }
});

// Submit Customer CSAT Rating
router.post('/:sessionId/csat', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { rating, feedback } = req.body;
    
    if (typeof rating !== 'number' || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be a number between 1 and 5' });
    }

    const session = await Session.findOneAndUpdate(
      { sessionId },
      { csatRating: rating, csatFeedback: feedback || '' },
      { new: true }
    );

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    await EventLog.create({
      sessionId,
      event: 'csat_submitted',
      details: { rating, feedback: (feedback || '').substring(0, 50) }
    });

    const notification = new Notification({
      agentId: session.agentId,
      title: 'New Customer Rating',
      body: `Customer left a ${rating}-star rating for session ${sessionId.substring(0, 8)}.`,
      type: 'rating'
    });
    await notification.save();

    const io = req.app.get('io');
    if (io) {
      io.to('agents-notifications').emit('agent-notification', notification);
    }

    res.json({ success: true, csatRating: session.csatRating, csatFeedback: session.csatFeedback, portalToken: session.portalToken });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to submit CSAT feedback' });
  }
});

// Public Customer Portal Endpoint (Unauthenticated)
router.get('/portal/:portalToken', async (req, res) => {
  try {
    const { portalToken } = req.params;
    const session = await Session.findOne({ portalToken });
    if (!session) {
      return res.status(404).json({ error: 'Portal access token is invalid or expired' });
    }

    const sessionId = session.sessionId;

    // Find recordings
    const recordings = await Recording.find({ sessionId });
    
    // Find files
    const files = await File.find({ sessionId });

    // Find tickets
    const tickets = await Ticket.find({ sessionId });

    res.json({
      success: true,
      session: {
        sessionId: session.sessionId,
        status: session.status,
        createdAt: session.createdAt,
        endedAt: session.endedAt,
        csatRating: session.csatRating,
        csatFeedback: session.csatFeedback
      },
      recordings,
      files,
      tickets
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch customer portal data' });
  }
});

export default router;
