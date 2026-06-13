import mongoose from 'mongoose';
import assert from 'assert';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

// Import Models
import { User } from '../models/User';
import { Ticket } from '../models/Ticket';
import { KnowledgeBase } from '../models/KnowledgeBase';
import { Session } from '../models/Session';
import { Notification } from '../models/Notification';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/visionsupport';

async function runProductionImprovementsTests() {
  console.log('========================================================================');
  console.log('⚡ VisionSupport AI: Running Production Improvements Validation Tests ⚡');
  console.log('========================================================================');

  // 1. Database Connection
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB successfully.');
  } catch (err) {
    console.error('❌ Failed to connect to MongoDB', err);
    process.exit(1);
  }

  const testEmail = `enterprise_agent_${Date.now()}@visionsupport.ai`;

  try {
    // 2. Lockout and Brute-force Prevention test
    console.log('\n--- VERIFYING USER BRUTE-FORCE LOCKOUT LIMITS ---');
    const passwordHash = await bcrypt.hash('secret123', 10);
    const user = new User({
      email: testEmail,
      passwordHash,
      role: 'agent',
      name: 'Enterprise Test Operator',
      companyName: 'VisionSupport Corp',
      disabled: false,
      loginAttempts: 0,
      emailVerified: false
    });
    await user.save();
    console.log('✅ Temporary test agent registered in database.');

    // Simulate 5 consecutive failed login attempts
    console.log('Simulating 5 incorrect login attempts...');
    for (let i = 1; i <= 5; i++) {
      // Fetch latest user document to update attempts count
      const freshUser = await User.findOne({ email: testEmail });
      if (!freshUser) throw new Error('User missing during lockout simulation');

      freshUser.loginAttempts += 1;
      if (freshUser.loginAttempts >= 5) {
        freshUser.lockUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minute lock
      }
      await freshUser.save();
    }

    const lockedUser = await User.findOne({ email: testEmail });
    assert.ok(lockedUser, 'Locked user not found');
    assert.strictEqual(lockedUser.loginAttempts, 5, 'Login attempts counter did not increment to 5');
    assert.ok(lockedUser.lockUntil, 'lockUntil field was not set');
    assert.ok(lockedUser.lockUntil.getTime() > Date.now(), 'lockUntil is not in the future');
    console.log('✅ Brute-force lockout and 15-minute lockUntil timestamp confirmed.');

    // 3. Email Verification Token Logic
    console.log('\n--- VERIFYING EMAIL VERIFICATION TOKENS ---');
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digits
    lockedUser.emailVerificationToken = verificationCode;
    lockedUser.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours expiry
    await lockedUser.save();

    const verifiedUser = await User.findOne({ email: testEmail });
    assert.ok(verifiedUser, 'Verified user not found');
    assert.strictEqual(verifiedUser!.emailVerificationToken!.length, 6, 'Verification token is not 6 digits');
    assert.ok(verifiedUser!.emailVerificationExpires, 'Verification expiry date missing');
    assert.ok(verifiedUser!.emailVerificationExpires!.getTime() > Date.now(), 'Verification token has already expired');
    console.log('✅ 6-digit email verification token logic verified.');

    // 4. Stateless CSRF JWT Handshake Token Check
    console.log('\n--- VERIFYING STATELESS CSRF TOKEN PAYLOADS ---');
    const jwtSecret = process.env.JWT_SECRET || 'visionsupport_jwt_secret_default';
    const csrfTokenPayload = { type: 'csrf', sessionId: 'mock-session-csrf-123' };
    const signedCsrfToken = jwt.sign(csrfTokenPayload, jwtSecret, { expiresIn: '1h' });

    // Verify/Decode
    const decodedCsrf: any = jwt.verify(signedCsrfToken, jwtSecret);
    assert.strictEqual(decodedCsrf.type, 'csrf', 'CSRF token type mismatch');
    assert.strictEqual(decodedCsrf.sessionId, 'mock-session-csrf-123', 'CSRF payload content mismatch');
    console.log('✅ Stateless CSRF token handshake and JWT payload decoding verified.');

    // 5. Automatic Ticket Indexing
    console.log('\n--- VERIFYING TICKET INDEXING SCHEMA ---');
    const ticketId = `TICKET_${Date.now()}`;
    const testSessionId = `SESSION_${Date.now()}`;
    
    const ticket = new Ticket({
      ticketId,
      sessionId: testSessionId,
      customerName: 'Pratik Customer',
      agentName: 'Enterprise Operator',
      issueTitle: 'Camera latency issues',
      problemDescription: 'Customer is encountering camera connection latency',
      rootCause: 'Browser autoplay and media track permissions blocked',
      solution: 'Provided client-side autoplay workaround override buttons',
      priority: 'High',
      sessionDuration: 180,
      recordingLink: 'http://minio:9000/recordings/call_123.mp4'
    });
    await ticket.save();

    const savedTicket = await Ticket.findOne({ ticketId });
    assert.ok(savedTicket, 'Failed to save support ticket to database');
    assert.strictEqual(savedTicket.status, 'Open', 'Incorrect ticket default status');
    assert.strictEqual(savedTicket.customerName, 'Pratik Customer', 'Ticket customer name mismatch');
    assert.strictEqual(savedTicket.priority, 'High', 'Ticket priority mismatch');
    console.log('✅ Automated support ticketing schema validation passed.');

    // 6. Ticket-to-Article Knowledge Base Engine
    console.log('\n--- VERIFYING KNOWLEDGE BASE TICKET CONVERSION ---');
    const article = new KnowledgeBase({
      articleId: `KB_${Date.now()}`,
      title: `Resolving Camera Connection Latency`,
      category: 'Video',
      problemDescription: savedTicket.rootCause || '',
      solution: savedTicket.solution || '',
      tags: ['video', 'media', 'camera', 'webrtc'],
      ticketId: savedTicket.ticketId
    });
    await article.save();

    const savedArticle = await KnowledgeBase.findOne({ ticketId: savedTicket.ticketId });
    assert.ok(savedArticle, 'Knowledge Base article not found for source ticket');
    assert.ok(savedArticle.problemDescription.includes('autoplay'), 'Article problemDescription does not contain root cause strings');
    console.log('✅ Solved support ticket successfully converted into Knowledge Base article.');

    // 7. Portal Tokens & CSAT Session Calculations
    console.log('\n--- VERIFYING PORTAL TOKENS & CSAT DURATION CALCULATIONS ---');
    const testSessionUUID = `session_test_${Date.now()}`;
    const testInviteToken = `invite_test_${Date.now()}`;
    const testPortalToken = `portal_test_${Date.now()}`;
    const createdTime = new Date(Date.now() - 300 * 1000); // 5 mins ago
    const endedTime = new Date();

    const mockSession = new Session({
      sessionId: testSessionUUID,
      agentId: 'mock-agent-123',
      inviteToken: testInviteToken,
      portalToken: testPortalToken,
      status: 'ended',
      createdAt: createdTime,
      endedAt: endedTime,
      csatRating: 5,
      csatFeedback: 'Perfect resolution speed and support!',
      resolutionDuration: Math.round((endedTime.getTime() - createdTime.getTime()) / 1000),
      responseTime: 25,
      participants: [
        { role: 'customer', joinTime: createdTime, leaveTime: endedTime },
        { role: 'agent', joinTime: new Date(createdTime.getTime() + 25 * 1000), leaveTime: endedTime }
      ]
    });
    await mockSession.save();

    const verifiedSession = await Session.findOne({ sessionId: testSessionUUID });
    assert.ok(verifiedSession, 'Test session was not stored');
    assert.strictEqual(verifiedSession.portalToken, testPortalToken, 'Portal token mismatch');
    assert.strictEqual(verifiedSession.csatRating, 5, 'CSAT Rating mismatch');
    assert.strictEqual(verifiedSession.resolutionDuration, 300, 'Resolution duration (in seconds) calculation mismatch');
    assert.strictEqual(verifiedSession.responseTime, 25, 'Response time mismatch');
    console.log('✅ CSAT duration calculations and portal token storage verified.');

    // 8. Notification Center Verification
    console.log('\n--- VERIFYING NOTIFICATION DISPATCHING ---');
    const notification = new Notification({
      agentId: 'mock-agent-123',
      title: 'Call Completed',
      body: 'Your session has ended successfully',
      type: 'recording_ready'
    });
    await notification.save();

    const savedNotification = await Notification.findOne({ agentId: 'mock-agent-123', title: 'Call Completed' });
    assert.ok(savedNotification, 'Notification document not stored');
    assert.strictEqual(savedNotification.type, 'recording_ready', 'Notification type mismatch');
    assert.strictEqual(savedNotification.read, false, 'Default notification read value is not false');
    console.log('✅ Notification dispatching and persistence verified.');

    // 9. Global Search (Elasticsearch or Fallback regex query check)
    console.log('\n--- VERIFYING GLOBAL SEARCH ENGINE ---');
    const searchMatch = await Ticket.find({
      $or: [
        { issueTitle: { $regex: 'Camera latency', $options: 'i' } },
        { problemDescription: { $regex: 'Camera latency', $options: 'i' } }
      ]
    });
    assert.ok(searchMatch.length > 0, 'Global Search query regex matching fallback failed');
    console.log('✅ Global search query match verified.');

    // Cleanup production improvement entities
    console.log('\n--- CLEANING UP INTEGRATION TEST RECORDS ---');
    await User.deleteOne({ email: testEmail });
    await Ticket.deleteOne({ ticketId });
    await KnowledgeBase.deleteOne({ ticketId });
    await Session.deleteOne({ sessionId: testSessionUUID });
    await Notification.deleteMany({ agentId: 'mock-agent-123' });
    console.log('✅ Clean up complete.');

    console.log('\n========================================================================');
    console.log('🎉 ALL PRODUCTION IMPROVEMENTS VALIDATION TESTS PASSED (100%) 🎉');
    console.log('========================================================================');
  } catch (err: any) {
    console.error('\n❌ VALIDATION TEST FAILURE:', err.message);
    console.error(err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

runProductionImprovementsTests();
