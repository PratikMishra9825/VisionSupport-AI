import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { createRoomRouter } from '../mediasoup';
type Router = any;
type WebRtcTransport = any;
type Producer = any;
type Consumer = any;
import { Participant } from '../models/Participant';
import { Message } from '../models/Message';
import { Whiteboard } from '../models/Whiteboard';
import { AITranscript } from '../models/AITranscript';
import { EventLog } from '../models/EventLog';
import { indexDocument } from '../services/search';
import { encryptText, decryptText } from '../services/security';
import { setCacheEx, getCache, delCache } from '../services/redis';
import { translateText } from '../services/gemini';
import { Notification } from '../models/Notification';
import { Session } from '../models/Session';

// In-memory media objects mapping
const sessionTransports: Map<string, Map<string, WebRtcTransport>> = new Map(); // sessionId -> (transportId -> Transport)
const participantProducers: Map<string, Map<string, Producer>> = new Map(); // socketId -> (producerId -> Producer)
const participantConsumers: Map<string, Map<string, Consumer>> = new Map(); // socketId -> (consumerId -> Consumer)
const reconnectionTimers: Map<string, NodeJS.Timeout> = new Map(); // userId -> ReconnectTimeout

export const setupSocketIO = (io: Server) => {
  // Middleware: Authenticate socket connection
  io.use((socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.query.token;
    if (!token) {
      return next(new Error('Authentication error: Missing token'));
    }
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET || 'visionsupport_jwt_secret_default') as any;
      (socket as any).user = payload;
      next();
    } catch (err) {
      // Allow customers with placeholders if joining via invite token
      if (token === 'customer-token-placeholder') {
        (socket as any).user = { id: `cust-${socket.id}`, name: 'Customer Guest', role: 'customer' };
        return next();
      }
      return next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', async (socket: Socket) => {
    const user = (socket as any).user;
    let currentSessionId = '';
    
    console.log(`Socket connected: ${socket.id} | User: ${user.name} | Role: ${user.role}`);

    if (user.role === 'agent' || user.role === 'supervisor') {
      socket.join('agents-notifications');
    }

    const dispatchAgentNotification = async (agentId: string, title: string, body: string, type: 'session_request' | 'ticket_update' | 'recording_ready' | 'rating' | 'ai_insight') => {
      try {
        const notification = new Notification({
          agentId,
          title,
          body,
          type
        });
        await notification.save();
        io.to('agents-notifications').emit('agent-notification', notification);
      } catch (err) {
        console.error('Notification dispatch failed:', err);
      }
    };

    // JOIN ROOM
    socket.on('join-room', async ({ sessionId, name }, callback) => {
      try {
        currentSessionId = sessionId;
        socket.join(sessionId);

        if (name) {
          user.name = name;
        }

        // Cancel reconnection timer if user was in a grace period
        const graceKey = `reconnect:${user.id}:${sessionId}`;
        const timer = reconnectionTimers.get(user.id);
        if (timer) {
          clearTimeout(timer);
          reconnectionTimers.delete(user.id);
          console.log(`Reconnected user ${user.name} within grace period. Restoring session.`);
          await EventLog.create({ sessionId, event: 'reconnected', details: { name: user.name, role: user.role } });
          socket.to(sessionId).emit('notification', { type: 'network', title: 'Participant Rejoined', body: `${user.name} reconnected.` });
        } else {
          await EventLog.create({ sessionId, event: 'joined', details: { name: user.name, role: user.role } });
        }

        // Initialize MediaSoup Router for this session
        const router = await createRoomRouter(sessionId);

        // Register participant in DB
        await Participant.findOneAndUpdate(
          { sessionId, userId: user.id },
          {
            socketId: socket.id,
            name: name || user.name,
            role: user.role,
            status: 'connected',
            joinTime: new Date(),
          },
          { upsert: true, new: true }
        );

        // Notify agent if customer joins
        const sessionDoc = await Session.findOne({ sessionId });
        if (sessionDoc && user.role === 'customer') {
          await dispatchAgentNotification(
            sessionDoc.agentId,
            'New Session Request',
            `Customer "${name || user.name}" has joined support room ${sessionId.substring(0, 8)}.`,
            'session_request'
          );
        }

        // Send existing room history states
        const messages = await Message.find({ sessionId }).sort({ timestamp: 1 });
        const decryptedMessages = messages.map(m => ({
          _id: m._id,
          sessionId: m.sessionId,
          senderId: m.senderId,
          senderName: m.senderName,
          senderRole: m.senderRole,
          text: decryptText(m.encryptedText),
          reactions: m.reactions,
          timestamp: m.timestamp,
        }));

        const whiteboard = await Whiteboard.findOne({ sessionId });
        const aiTranscript = await AITranscript.findOne({ sessionId });

        // Get existing producers in the room
        const room = io.sockets.adapter.rooms.get(sessionId);
        const existingProducers: any[] = [];
        if (room) {
          for (const memberSocketId of room) {
            if (memberSocketId !== socket.id) {
              const producers = participantProducers.get(memberSocketId);
              if (producers) {
                for (const [producerId, producer] of producers.entries()) {
                  const memberSocket = io.sockets.sockets.get(memberSocketId);
                  const memberUser = (memberSocket as any)?.user || {};
                  existingProducers.push({
                    producerId,
                    userId: memberUser.id || '',
                    name: memberUser.name || 'User Guest',
                    role: memberUser.role || 'customer',
                    kind: producer.kind,
                    ownerSocketId: memberSocketId,
                  });
                }
              }
            }
          }
        }

        console.log(`[Diagnostic] join-room: Room ID: ${sessionId} | Producer Count: ${existingProducers.length} | Producers:`, existingProducers.map(p => ({ producerId: p.producerId, kind: p.kind, ownerName: p.name })));

        callback({
          success: true,
          routerRtpCapabilities: router.rtpCapabilities,
          messages: decryptedMessages,
          whiteboard: whiteboard ? whiteboard.elements : [],
          transcript: aiTranscript ? aiTranscript.segments : [],
          producers: existingProducers,
        });

        // Broadcast to others
        socket.to(sessionId).emit('participant-joined', {
          userId: user.id,
          socketId: socket.id,
          name: name || user.name,
          role: user.role,
        });

      } catch (err: any) {
        console.error('Join room socket failed:', err);
        callback({ error: err.message });
      }
    });

    // WEBRTC SIGNALING HANDLERS
    socket.on('get-router-rtp-capabilities', async (callback) => {
      const router = await createRoomRouter(currentSessionId);
      callback(router.rtpCapabilities);
    });

    socket.on('create-webrtc-transport', async (_, callback) => {
      try {
        const router = await createRoomRouter(currentSessionId);
        
        const transport = await router.createWebRtcTransport({
          listenInfos: [
            {
              protocol: 'udp',
              ip: process.env.MEDIASOUP_LISTEN_IP || '0.0.0.0',
              announcedAddress: process.env.MEDIASOUP_ANNOUNCED_IP || '127.0.0.1',
            },
            {
              protocol: 'tcp',
              ip: process.env.MEDIASOUP_LISTEN_IP || '0.0.0.0',
              announcedAddress: process.env.MEDIASOUP_ANNOUNCED_IP || '127.0.0.1',
            }
          ],
          enableUdp: true,
          enableTcp: true,
          preferUdp: true,
        });

        console.log(`[Diagnostic Server] create-webrtc-transport success: sessionId = ${currentSessionId} | transportId = ${transport.id}`);

        // Store transport in-memory
        if (!sessionTransports.has(currentSessionId)) {
          sessionTransports.set(currentSessionId, new Map());
        }
        sessionTransports.get(currentSessionId)!.set(transport.id, transport);

        transport.on('dtlsstatechange', (dtlsState: any) => {
          console.log(`[Diagnostic Server] transport dtlsstatechange: transportId = ${transport.id} | dtlsState = ${dtlsState}`);
          if (dtlsState === 'closed') {
            transport.close();
          }
        });

        callback({
          id: transport.id,
          iceParameters: transport.iceParameters,
          iceCandidates: transport.iceCandidates,
          dtlsParameters: transport.dtlsParameters,
        });
      } catch (err: any) {
        console.error('Create transport failed:', err);
        callback({ error: err.message });
      }
    });

    socket.on('connect-transport', async ({ transportId, dtlsParameters }, callback) => {
      console.log(`[Diagnostic Server] connect-transport request: sessionId = ${currentSessionId} | transportId = ${transportId}`);
      const transport = sessionTransports.get(currentSessionId)?.get(transportId);
      if (transport) {
        try {
          await transport.connect({ dtlsParameters });
          console.log(`[Diagnostic Server] connect-transport success: transportId = ${transportId}`);
          callback();
        } catch (e: any) {
          console.error(`[Diagnostic Server] connect-transport connect call failed:`, e);
          callback({ error: e.message || e });
        }
      } else {
        console.warn(`[Diagnostic Server] connect-transport failed - transport not found: ${transportId}`);
        callback({ error: 'Transport not found' });
      }
    });

    socket.on('produce', async ({ transportId, kind, rtpParameters }, callback) => {
      // SECURITY Check: Observers are prohibited from producing audio/video
      if (user.role === 'observer') {
        return callback({ error: 'Observers are not allowed to send media streams' });
      }

      console.log(`[Diagnostic Server] produce request: transportId = ${transportId} | kind = ${kind} | user = ${user.name}`);
      const transport = sessionTransports.get(currentSessionId)?.get(transportId);
      if (!transport) {
        return callback({ error: 'Transport not found' });
      }

      const producer = await transport.produce({ kind, rtpParameters });
      
      if (!participantProducers.has(socket.id)) {
        participantProducers.set(socket.id, new Map());
      }
      participantProducers.get(socket.id)!.set(producer.id, producer);

      console.log(`[Diagnostic] produce: Producer Created: ID: ${producer.id} | Kind: ${kind} | Socket ID: ${socket.id} | Owner Name: ${user.name}`);

      // Notify others in room
      socket.to(currentSessionId).emit('new-producer', {
        producerId: producer.id,
        ownerSocketId: socket.id,
        ownerName: user.name || 'User Guest',
        role: user.role || 'customer',
        kind,
      });

      callback({ id: producer.id });
    });

    socket.on('consume', async ({ rtpCapabilities, producerId, transportId }, callback) => {
      console.log(`[Diagnostic Server] consume request: producerId = ${producerId} | transportId = ${transportId}`);
      const router = await createRoomRouter(currentSessionId);
      const transport = sessionTransports.get(currentSessionId)?.get(transportId);
      
      if (!transport) return callback({ error: 'Transport not found' });

      if (router.canConsume({ producerId, rtpCapabilities })) {
        const consumer = await transport.consume({
          producerId,
          rtpCapabilities,
          paused: true,
        });

        if (!participantConsumers.has(socket.id)) {
          participantConsumers.set(socket.id, new Map());
        }
        participantConsumers.get(socket.id)!.set(consumer.id, consumer);

        consumer.on('transportclose', () => {
          console.log(`[Diagnostic Server] consumer transportclose: consumerId = ${consumer.id}`);
          consumer.close();
        });

        console.log(`[Diagnostic Server] consume success: consumerId = ${consumer.id} | producerId = ${producerId} | kind = ${consumer.kind}`);

        callback({
          id: consumer.id,
          producerId,
          kind: consumer.kind,
          rtpParameters: consumer.rtpParameters,
        });
      } else {
        console.warn(`[Diagnostic Server] consume failed - router cannot consume producerId = ${producerId}`);
        callback({ error: 'Cannot consume' });
      }
    });

    socket.on('consumer-resume', async ({ consumerId }, callback) => {
      console.log(`[Diagnostic Server] consumer-resume request: consumerId = ${consumerId}`);
      const consumer = participantConsumers.get(socket.id)?.get(consumerId);
      if (consumer) {
        await consumer.resume();
        console.log(`[Diagnostic Server] consumer-resume success: consumerId = ${consumerId}`);
        callback();
      } else {
        console.warn(`[Diagnostic Server] consumer-resume failed - consumer not found: ${consumerId}`);
        callback({ error: 'Consumer not found' });
      }
    });

    // CHAT CHANNELS
    socket.on('send-chat-message', async ({ text, targetLang }, callback) => {
      try {
        const encryptedText = encryptText(text);
        const msgDoc = new Message({
          sessionId: currentSessionId,
          senderId: user.id,
          senderName: user.name,
          senderRole: user.role,
          encryptedText,
        });
        await msgDoc.save();

        // Index in Elasticsearch
        await indexDocument('messages', msgDoc._id.toString(), {
          sessionId: currentSessionId,
          senderName: user.name,
          text,
          timestamp: msgDoc.timestamp
        });

        let responseText = text;
        if (targetLang && targetLang !== 'default') {
          // Translate real-time subtitle using Gemini
          responseText = await translateText(text, targetLang);
        }

        const msgPayload = {
          _id: msgDoc._id,
          senderId: user.id,
          senderName: user.name,
          senderRole: user.role,
          text: responseText,
          timestamp: msgDoc.timestamp,
        };

        io.to(currentSessionId).emit('chat-message', msgPayload);
        
        await EventLog.create({
          sessionId: currentSessionId,
          event: 'chat_sent',
          details: { name: user.name, text: text.substring(0, 30) }
        });

        callback({ success: true });
      } catch (err: any) {
        callback({ error: err.message });
      }
    });

    socket.on('chat-message-reaction', async ({ messageId, emoji }) => {
      const msg = await Message.findById(messageId);
      if (msg) {
        msg.reactions.push({ userId: user.id, emoji });
        await msg.save();
        io.to(currentSessionId).emit('message-reaction-updated', {
          messageId,
          reactions: msg.reactions,
        });
      }
    });

    socket.on('chat-typing', ({ isTyping }) => {
      socket.to(currentSessionId).emit('chat-typing-status', {
        userId: user.id,
        name: user.name,
        isTyping,
      });
    });

    // WHITEBOARD DRAWING SYNC
    socket.on('whiteboard-draw', async ({ element }) => {
      socket.to(currentSessionId).emit('whiteboard-element-added', { element });
      
      // Save element to whiteboard canvas DB
      await Whiteboard.findOneAndUpdate(
        { sessionId: currentSessionId },
        { $push: { elements: element } },
        { upsert: true }
      );

      await EventLog.create({
        sessionId: currentSessionId,
        event: 'whiteboard_drawn',
        details: { name: user.name, type: element.type }
      });
    });

    socket.on('whiteboard-clear', async () => {
      await Whiteboard.findOneAndDelete({ sessionId: currentSessionId });
      io.to(currentSessionId).emit('whiteboard-cleared');
    });

    // Screen Share start/stop toggle event logging
    socket.on('screen-share-toggle', async ({ started }) => {
      await EventLog.create({
        sessionId: currentSessionId,
        event: started ? 'screen_share_started' : 'screen_share_stopped',
        details: { name: user.name, role: user.role }
      });
      socket.to(currentSessionId).emit('screen-share-toggled', { userId: user.id, name: user.name, started });
    });

    // Multi-user Cursor positions
    socket.on('cursor-move', ({ x, y }) => {
      socket.to(currentSessionId).emit('remote-cursor', {
        userId: user.id,
        name: user.name,
        x,
        y,
      });
    });

    // Laser pointer coordinate
    socket.on('laser-pointer', ({ x, y, isDrawing }) => {
      socket.to(currentSessionId).emit('remote-laser', {
        userId: user.id,
        x,
        y,
        isDrawing,
      });
    });

    // Screen Share Annotation Drawing Sync
    socket.on('screen-annotation', async ({ annotation }) => {
      socket.to(currentSessionId).emit('remote-annotation', { annotation });
      await EventLog.create({
        sessionId: currentSessionId,
        event: 'whiteboard_drawn',
        details: { name: user.name, type: 'screen_annotation', annotation }
      });
    });

    // REAL-TIME SPEECH-TO-TEXT AND TRANSLATION SUBTITLES
    socket.on('speech-chunk', async ({ text }) => {
      try {
        let transcript = await AITranscript.findOne({ sessionId: currentSessionId });
        if (!transcript) {
          transcript = new AITranscript({ sessionId: currentSessionId, segments: [] });
        }

        // Add segment
        const segment: any = {
          speakerId: user.id,
          speakerName: user.name,
          speakerRole: user.role,
          text,
          timestamp: new Date()
        };
        
        transcript.segments.push(segment);
        await transcript.save();

        io.to(currentSessionId).emit('new-subtitle', {
          speakerName: user.name,
          text,
        });
      } catch (err) {
        console.error('Speech segment transcription failed:', err);
      }
    });

    // SUPERVISOR COMMANDS
    socket.on('mute-participant', async ({ userId }) => {
      if (user.role !== 'supervisor' && user.role !== 'agent') return;
      
      io.to(currentSessionId).emit('force-mute-mic', { userId });
      await EventLog.create({
        sessionId: currentSessionId,
        event: 'force_muted_participant',
        details: { targetUserId: userId, actionBy: user.name }
      });
    });

    socket.on('takeover-call', async () => {
      if (user.role !== 'supervisor') return;
      
      io.to(currentSessionId).emit('supervisor-takeover', { name: user.name });
      await EventLog.create({
        sessionId: currentSessionId,
        event: 'supervisor_takeover',
        details: { supervisorName: user.name }
      });
    });

    socket.on('send-private-note', ({ note }) => {
      if (user.role !== 'supervisor' && user.role !== 'agent') return;
      // Broadcast strictly to agents and supervisors in room
      const room = io.sockets.adapter.rooms.get(currentSessionId);
      if (room) {
        for (const socketId of room) {
          const clientSocket = io.sockets.sockets.get(socketId);
          const clientRole = (clientSocket as any)?.user?.role;
          if (clientRole === 'agent' || clientRole === 'supervisor') {
            clientSocket?.emit('private-note-message', {
              senderName: user.name,
              note,
              timestamp: new Date()
            });
          }
        }
      }
    });

    // TELEMETRY Teleport statistics push
    socket.on('telemetry-quality', async ({ bitrate, packetLoss, jitter, latency }) => {
      await Participant.findOneAndUpdate(
        { sessionId: currentSessionId, userId: user.id },
        { bitrate, packetLoss, jitter, latency }
      );
    });

    // DISCONNECT & IMMEDIATE CLEANUP
    socket.on('disconnect', async () => {
      console.log(`Socket disconnected: ${socket.id} (User: ${user.name})`);
      
      if (!currentSessionId) return;

      // Close producers immediately
      const producers = participantProducers.get(socket.id);
      if (producers) {
        for (const producer of producers.values()) {
          producer.close();
          // Notify others producer closed
          socket.to(currentSessionId).emit('producer-closed', { producerId: producer.id });
          console.log(`[Diagnostic] Closed producer ${producer.id} of disconnected socket ${socket.id}`);
        }
        participantProducers.delete(socket.id);
      }

      // Mark participant as disconnected
      await Participant.findOneAndUpdate(
        { sessionId: currentSessionId, userId: user.id },
        { status: 'disconnected', leaveTime: new Date() }
      );

      // Clean up consumers
      const consumers = participantConsumers.get(socket.id);
      if (consumers) {
        for (const consumer of consumers.values()) {
          consumer.close();
        }
        participantConsumers.delete(socket.id);
      }

      // Notify others that participant left
      socket.to(currentSessionId).emit('participant-left', { userId: user.id, socketId: socket.id });
    });
  });
};
