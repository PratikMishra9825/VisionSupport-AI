"use client";
import { API_BASE, SOCKET_BASE } from '@/config';

import { useEffect, useState, useRef, Suspense, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useStore, MessagePayload } from '@/store/useStore';
import { io, Socket } from 'socket.io-client';
import * as mediasoupClient from 'mediasoup-client';
import { motion, AnimatePresence } from 'framer-motion';
import VideoGrid from '@/components/VideoGrid';
import Chat from '@/components/Chat';
import Whiteboard from '@/components/Whiteboard';
import FileShare from '@/components/FileShare';
import AIAssistantPanel from '@/components/AIAssistantPanel';
import { 
  Tv, Eye, ShieldCheck, UserCheck, MessageSquare, Edit2, 
  HelpCircle, Sparkles, Mic, FileText, Settings, Play, Square, Pause, Star,
  ShieldAlert, Activity
} from 'lucide-react';

function SessionRoomInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const sessionId = params.id as string;
  const inviteToken = searchParams.get('token');
  const router = useRouter();
  
  const { role, token, name, logout, recordingState, setRecordingState, setAuth, setSession } = useStore();

  const [socket, setSocket] = useState<Socket | null>(null);
  const [activeTab, setActiveTab] = useState<'video' | 'whiteboard' | 'chat' | 'files' | 'ai'>('video');
  const [subtitle, setSubtitle] = useState<string | null>(null);
  const [transcripts, setTranscripts] = useState<Array<{ speaker: string; text: string; time: string }>>([]);
  const [showCsatModal, setShowCsatModal] = useState(false);
  const [csatRating, setCsatRating] = useState(5);
  const [csatFeedback, setCsatFeedback] = useState('');
  const [submittingCsat, setSubmittingCsat] = useState(false);
  
  // MediaStreams state
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, { stream: MediaStream; name: string; role: string }>>(new Map());
  const [micEnabled, setMicEnabled] = useState(true);
  const [camEnabled, setCamEnabled] = useState(true);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [voiceAssistantActiveState, setVoiceAssistantActive] = useState(false);
  const voiceAssistantActive = voiceAssistantActiveState;
  const [portalToken, setPortalToken] = useState('');
  const [mediaError, setMediaError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const initMediaAndSocketRef = useRef<(() => void) | null>(null);
  const isInitializingRef = useRef(false); // STEP 1: Guard against double getUserMedia
  const getUserMediaCallCountRef = useRef(0); // STEP 1: Track call count

  // STEP 6: Available devices for switching
  const [availableDevices, setAvailableDevices] = useState<{ cameras: MediaDeviceInfo[]; microphones: MediaDeviceInfo[] }>({ cameras: [], microphones: [] });
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  const [selectedMic, setSelectedMic] = useState<string>('');
  
  // Diagnostics State (STEP 9: Enhanced with camera/mic/track/error info)
  const [diagnostics, setDiagnostics] = useState<any>({
    deviceLoaded: false,
    sendTransportState: 'none',
    recvTransportState: 'none',
    producers: [],
    consumers: [],
    bitrate: 0,
    packetLoss: 0,
    rtt: 0,
    // STEP 9 additions
    cameraState: 'unknown',
    micState: 'unknown',
    audioTrackEnabled: false,
    audioTrackReadyState: 'none',
    videoTrackEnabled: false,
    videoTrackReadyState: 'none',
    currentCameraDevice: '',
    currentMicDevice: '',
    errorName: '',
    errorMessage: '',
    getUserMediaCallCount: 0,
    socketCount: 0,
    localStreamCount: 0,
  });

  // Web Audio Context constraints
  const [audioConstraints, setAudioConstraints] = useState({
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  });

  // MediaSoup variables refs
  const deviceRef = useRef<mediasoupClient.Device | null>(null);
  const sendTransportRef = useRef<mediasoupClient.types.Transport | null>(null);
  const recvTransportRef = useRef<mediasoupClient.types.Transport | null>(null);
  const localAudioProducerRef = useRef<mediasoupClient.types.Producer | null>(null);
  const localVideoProducerRef = useRef<mediasoupClient.types.Producer | null>(null);

  const activeConsumersRef = useRef<Map<string, { consumer: mediasoupClient.types.Consumer; ownerSocketId: string; name: string; role: string }>>(new Map());
  const pendingProducersRef = useRef<any[]>([]);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const producerToConsumerMapRef = useRef<Map<string, mediasoupClient.types.Consumer>>(new Map());
  const consumerToStreamMapRef = useRef<Map<string, MediaStream>>(new Map());
  const socketRef = useRef<Socket | null>(null);

  const updateDiagnostics = () => {
    const sendT = sendTransportRef.current;
    const recvT = recvTransportRef.current;
    const device = deviceRef.current;
    const stream = localStreamRef.current;

    const producersList: any[] = [];
    if (localAudioProducerRef.current) producersList.push({ id: localAudioProducerRef.current.id, kind: 'audio' });
    if (localVideoProducerRef.current) producersList.push({ id: localVideoProducerRef.current.id, kind: 'video' });

    const consumersList: any[] = [];
    activeConsumersRef.current.forEach(({ consumer, name }) => {
      consumersList.push({
        id: consumer.id,
        producerId: consumer.producerId,
        kind: consumer.kind,
        trackState: consumer.track.readyState,
        trackEnabled: consumer.track.enabled,
        owner: name
      });
    });

    // STEP 9: Gather live track state
    const audioTrack = stream?.getAudioTracks()[0];
    const videoTrack = stream?.getVideoTracks()[0];

    setDiagnostics((prev: any) => ({
      ...prev,
      deviceLoaded: device ? device.loaded : false,
      sendTransportState: sendT ? sendT.connectionState : 'none',
      recvTransportState: recvT ? recvT.connectionState : 'none',
      producers: producersList,
      consumers: consumersList,
      // STEP 9: Live track info
      cameraState: videoTrack ? (videoTrack.enabled ? 'active' : 'muted') : 'no-track',
      micState: audioTrack ? (audioTrack.enabled ? 'active' : 'muted') : 'no-track',
      audioTrackEnabled: audioTrack?.enabled ?? false,
      audioTrackReadyState: audioTrack?.readyState ?? 'none',
      videoTrackEnabled: videoTrack?.enabled ?? false,
      videoTrackReadyState: videoTrack?.readyState ?? 'none',
      currentCameraDevice: videoTrack?.label ?? 'N/A',
      currentMicDevice: audioTrack?.label ?? 'N/A',
      getUserMediaCallCount: getUserMediaCallCountRef.current,
      socketCount: socketRef.current ? 1 : 0,
      localStreamCount: localStreamRef.current ? 1 : 0,
    }));
  };

  const consumeProducer = async (socketClient: Socket, producerInfo: { producerId: string; ownerSocketId: string; ownerName: string; role: string; kind: 'audio' | 'video' }) => {
    const device = deviceRef.current;
    const recvTransport = recvTransportRef.current;

    // Check if we are already consuming this producer
    if (producerToConsumerMapRef.current.has(producerInfo.producerId)) {
      console.log(`[Diagnostic] Already consuming producer ${producerInfo.producerId}. Ignoring.`);
      return;
    }

    // Check if already in pending queue
    const isPending = pendingProducersRef.current.some(p => p.producerInfo.producerId === producerInfo.producerId);
    if (isPending) {
      console.log(`[Diagnostic] Producer ${producerInfo.producerId} is already in pending queue. Ignoring.`);
      return;
    }

    if (!device || !recvTransport) {
      console.log(`[Diagnostic] recvTransport not ready. Queueing producer ${producerInfo.producerId}`);
      pendingProducersRef.current.push({ socketClient, producerInfo });
      return;
    }

    // Step 5 - Receive Transport Log
    console.log(`[Diagnostic] recvTransport: ID: ${recvTransport.id} | connectionState: ${recvTransport.connectionState}`);

    console.log(`[Diagnostic] Consuming producer ${producerInfo.producerId} (${producerInfo.kind}) from ${producerInfo.ownerName}`);

    socketClient.emit('consume', {
      rtpCapabilities: device.rtpCapabilities,
      producerId: producerInfo.producerId,
      transportId: recvTransport.id
    }, async (res: any) => {
      if (res.error) {
        console.error(`[Diagnostic] consume() server error:`, res.error);
        return;
      }

      console.log(`[Diagnostic] consume() server success response:`, res);

      // Check again after async callback to prevent race conditions
      if (producerToConsumerMapRef.current.has(producerInfo.producerId)) {
        console.log(`[Diagnostic] Already consumed producer ${producerInfo.producerId} after server response. Ignoring.`);
        return;
      }

      try {
        const consumer = await recvTransport.consume({
          id: res.id,
          producerId: res.producerId,
          kind: res.kind,
          rtpParameters: res.rtpParameters
        });

        // Store in maps
        producerToConsumerMapRef.current.set(producerInfo.producerId, consumer);

        activeConsumersRef.current.set(consumer.id, {
          consumer,
          ownerSocketId: producerInfo.ownerSocketId,
          name: producerInfo.ownerName,
          role: producerInfo.role
        });

        // Step 6 - consume() Log
        console.log(`[Diagnostic] consume: Producer ID: ${res.producerId} | Consumer ID: ${consumer.id} | Kind: ${consumer.kind} | Track readyState: ${consumer.track.readyState} | Track enabled: ${consumer.track.enabled}`);

        const track = consumer.track;

        const finishConsumption = () => {
          // Step 8 - consumer.resume() Log before and after
          console.log(`[Diagnostic] Resuming consumer ${consumer.id}. Pause state before resume: ${consumer.paused}`);
          socketClient.emit('consumer-resume', { consumerId: consumer.id }, () => {
            console.log(`[Diagnostic] Consumer ${consumer.id} resumed on server. Pause state after resume: ${consumer.paused}`);
            
            // Create / update remote stream
            setRemoteStreams(prev => {
              const next = new Map(prev);
              const existing = next.get(producerInfo.ownerSocketId);
              let stream = existing?.stream;
              if (!stream) {
                // Step 8: Attach MediaStreams properly
                stream = new MediaStream();
              }
              // Remove old track of the same kind to prevent duplicates
              const oldTrack = stream.getTracks().find(t => t.kind === track.kind);
              if (oldTrack) {
                stream.removeTrack(oldTrack);
              }
              
              stream.addTrack(track);

              // Store the media stream in consumerToStreamMapRef
              consumerToStreamMapRef.current.set(consumer.id, stream);

              // Step 8 - MediaStream Log
              console.log(`[Diagnostic] MediaStream: tracks =`, stream.getTracks().map(t => ({ kind: t.kind, readyState: t.readyState, enabled: t.enabled })));

              next.set(producerInfo.ownerSocketId, {
                stream,
                name: producerInfo.ownerName,
                role: producerInfo.role
              });
              return next;
            });

            // If it is an audio track, handle autoplay
            if (track.kind === 'audio') {
              const audio = new Audio();
              audio.srcObject = new MediaStream([track]);
              audio.play().then(() => {
                console.log(`[Diagnostic] Remote audio track playing successfully.`);
              }).catch(err => {
                console.warn(`[Diagnostic] Remote audio autoplay blocked:`, err);
                setAutoplayBlocked(true);
              });
            }

            updateDiagnostics();
          });
        };

        // STEP 7: Wait until recvTransport.connectionState === connected. ONLY THEN consumer.resume()
        if (recvTransport.connectionState === 'connected') {
          finishConsumption();
        } else {
          console.log(`[Diagnostic] recvTransport connectionState is ${recvTransport.connectionState}. Waiting for connected before resuming...`);
          const onStateChange = async (state: string) => {
            console.log(`[Diagnostic] recvTransport state event: ${state}`);
            if (state === 'connected') {
              finishConsumption();
              recvTransport.off('connectionstatechange', onStateChange);
            } else if (state === 'failed' || state === 'closed') {
              recvTransport.off('connectionstatechange', onStateChange);
            }
          };
          recvTransport.on('connectionstatechange', onStateChange);
        }

      } catch (err) {
        console.error(`[Diagnostic] Error creating client-side consumer:`, err);
      }
    });
  };

  const negotiateTransports = async (socketClient: Socket) => {
    const stream = localStreamRef.current;
    if (!stream) {
      console.warn("[Diagnostic] negotiateTransports called but localStream is null.");
      return;
    }

    // A. Create Send Transport
    socketClient.emit('create-webrtc-transport', {}, async (transportParams: any) => {
      console.log(`[Diagnostic] create-webrtc-transport (send) response:`, transportParams);
      if (transportParams.error) return;

      const sendTransport = deviceRef.current!.createSendTransport(transportParams);
      sendTransportRef.current = sendTransport;

      sendTransport.on('connect', ({ dtlsParameters }, callback, errback) => {
        console.log(`[Diagnostic] sendTransport connect event triggered.`);
        socketClient.emit('connect-transport', { transportId: sendTransport.id, dtlsParameters }, (res: any) => {
          if (res?.error) {
            console.error(`[Diagnostic] sendTransport connect error:`, res.error);
            errback(res.error);
          } else {
            console.log(`[Diagnostic] sendTransport connect success.`);
            callback();
          }
        });
      });

      sendTransport.on('produce', ({ kind, rtpParameters }, callback, errback) => {
        console.log(`[Diagnostic] sendTransport produce event triggered. Kind = ${kind}`);
        socketClient.emit('produce', { transportId: sendTransport.id, kind, rtpParameters }, (res: any) => {
          if (res?.error) {
            console.error(`[Diagnostic] sendTransport produce error:`, res.error);
            errback(res.error);
          } else {
            console.log(`[Diagnostic] sendTransport produce success. Producer ID: ${res.id}`);
            callback({ id: res.id });
          }
        });
      });

      sendTransport.on('connectionstatechange', (state) => {
        console.log(`[Diagnostic] sendTransport connectionState changed to: ${state}`);
        console.log(`[Diagnostic] sendTransport states: connectionState = ${sendTransport.connectionState}`);
        updateDiagnostics();
      });

      // Produce mic track
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack && audioTrack.readyState === 'live' && micEnabled) {
        try {
          localAudioProducerRef.current = await sendTransport.produce({ track: audioTrack });
          // Step 4 - Producer Creation Log
          console.log(`[Diagnostic] local producer created: ID: ${localAudioProducerRef.current.id} | Kind: audio | Owner Socket ID: ${socketClient.id} | Owner Name: ${name}`);
        } catch(e) {
          console.error("[Diagnostic] Error producing local audio:", e);
        }
      } else if (audioTrack && audioTrack.readyState !== 'live') {
        console.warn(`[Diagnostic] Audio track readyState is '${audioTrack.readyState}' — skipping produce. Track may be from a stale session.`);
      }

      // Produce video track
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack && videoTrack.readyState === 'live' && camEnabled) {
        try {
          localVideoProducerRef.current = await sendTransport.produce({ track: videoTrack });
          // Step 4 - Producer Creation Log
          console.log(`[Diagnostic] local producer created: ID: ${localVideoProducerRef.current.id} | Kind: video | Owner Socket ID: ${socketClient.id} | Owner Name: ${name}`);
        } catch(e) {
          console.error("[Diagnostic] Error producing local video:", e);
        }
      } else if (videoTrack && videoTrack.readyState !== 'live') {
        console.warn(`[Diagnostic] Video track readyState is '${videoTrack.readyState}' — skipping produce. Track may be from a stale session.`);
      }

      updateDiagnostics();
    });

    // B. Create Recv Transport (to consume other participants)
    socketClient.emit('create-webrtc-transport', {}, async (transportParams: any) => {
      console.log(`[Diagnostic] create-webrtc-transport (recv) response:`, transportParams);
      if (transportParams.error) return;

      const recvTransport = deviceRef.current!.createRecvTransport(transportParams);
      recvTransportRef.current = recvTransport;

      recvTransport.on('connect', ({ dtlsParameters }, callback, errback) => {
        console.log(`[Diagnostic] recvTransport connect event triggered.`);
        socketClient.emit('connect-transport', { transportId: recvTransport.id, dtlsParameters }, (res: any) => {
          if (res?.error) {
            console.error(`[Diagnostic] recvTransport connect error:`, res.error);
            errback(res.error);
          } else {
            console.log(`[Diagnostic] recvTransport connect success.`);
            callback();
          }
        });
      });

      recvTransport.on('connectionstatechange', (state) => {
        console.log(`[Diagnostic] recvTransport connectionState changed to: ${state}`);
        console.log(`[Diagnostic] recvTransport states: connectionState = ${recvTransport.connectionState}`);
        updateDiagnostics();
      });

      console.log(`[Diagnostic] recvTransport created. Processing ${pendingProducersRef.current.length} queued producers.`);

      // Process any queued producers
      const queued = [...pendingProducersRef.current];
      pendingProducersRef.current = [];
      queued.forEach(({ socketClient: client, producerInfo }) => {
        consumeProducer(client, producerInfo);
      });

      updateDiagnostics();
    });
  };

  useEffect(() => {
    if (!role) {
      if (!inviteToken) {
        router.push('/');
      }
      return;
    }

    const registerSocketListeners = (socketInstance: Socket) => {
      console.log("[Diagnostic] Registering socket event listeners strictly once.");
      
      // Step 9: Verify that join-room listeners are registered ONLY ONCE
      socketInstance.off('new-producer');
      socketInstance.on('new-producer', (producerInfo: any) => {
        console.log(`[Diagnostic] Event 'new-producer' received:`, producerInfo);
        consumeProducer(socketInstance, producerInfo);
      });

      socketInstance.off('producer-closed');
      socketInstance.on('producer-closed', ({ producerId }) => {
        console.log(`[Diagnostic] Event 'producer-closed' received: producerId = ${producerId}`);
        
        // Cleanup from producerToConsumerMapRef
        const consumer = producerToConsumerMapRef.current.get(producerId);
        if (consumer) {
          consumer.close();
          producerToConsumerMapRef.current.delete(producerId);
        }

        for (const [consumerId, value] of activeConsumersRef.current.entries()) {
          if (value.consumer.producerId === producerId) {
            value.consumer.close();
            const { ownerSocketId } = value;
            setRemoteStreams(prev => {
              const next = new Map(prev);
              const existing = next.get(ownerSocketId);
              if (existing) {
                existing.stream.removeTrack(value.consumer.track);
                if (existing.stream.getTracks().length === 0) {
                  next.delete(ownerSocketId);
                } else {
                  next.set(ownerSocketId, { ...existing });
                }
              }
              return next;
            });
            activeConsumersRef.current.delete(consumerId);
            updateDiagnostics();
            break;
          }
        }
      });

      socketInstance.off('participant-left');
      socketInstance.on('participant-left', ({ userId, socketId }) => {
        console.log(`[Diagnostic] Event 'participant-left' received: userId = ${userId}, socketId = ${socketId}`);
        for (const [consumerId, value] of activeConsumersRef.current.entries()) {
          if (value.ownerSocketId === socketId) {
            value.consumer.close();
            producerToConsumerMapRef.current.delete(value.consumer.producerId);
            activeConsumersRef.current.delete(consumerId);
          }
        }
        setRemoteStreams(prev => {
          const next = new Map(prev);
          next.delete(socketId);
          return next;
        });
        updateDiagnostics();
      });

      socketInstance.off('new-subtitle');
      socketInstance.on('new-subtitle', ({ speakerName, text }) => {
        setSubtitle(`${speakerName}: "${text}"`);
        setTranscripts(prev => [...prev, { speaker: speakerName, text, time: new Date().toLocaleTimeString() }]);
        setTimeout(() => setSubtitle(null), 4000);
      });

      socketInstance.off('session-ended');
      socketInstance.on('session-ended', () => {
        console.log(`[Diagnostic] Event 'session-ended' received`);
        if (useStore.getState().role === 'customer') {
          setShowCsatModal(true);
        } else {
          alert('Session has been ended by the host.');
          logout();
          router.push('/dashboard');
        }
      });

      socketInstance.off('force-mute-mic');
      socketInstance.on('force-mute-mic', ({ userId }) => {
        if (userId === useStore.getState().token) {
          setMicEnabled(false);
          const stream = localStreamRef.current;
          if (stream) {
            stream.getAudioTracks().forEach(t => t.enabled = false);
          }
          alert('You have been muted by a supervisor.');
        }
      });

      socketInstance.off('supervisor-takeover');
      socketInstance.on('supervisor-takeover', ({ name }) => {
        alert(`Supervisor ${name} has taken control of the session.`);
      });

      socketInstance.off('private-note-message');
      socketInstance.on('private-note-message', (data: any) => {
        console.log(`[Diagnostic] Event 'private-note-message' received:`, data);
        useStore.getState().addPrivateNote(data);
      });
    };

    const joinAndInitialize = (socketInstance: Socket) => {
      // Clean up previous call state if reconnecting
      if (sendTransportRef.current) {
        try { sendTransportRef.current.close(); } catch(e){}
        sendTransportRef.current = null;
      }
      if (recvTransportRef.current) {
        try { recvTransportRef.current.close(); } catch(e){}
        recvTransportRef.current = null;
      }
      activeConsumersRef.current.forEach(({ consumer }) => {
        try { consumer.close(); } catch(e){}
      });
      activeConsumersRef.current.clear();
      producerToConsumerMapRef.current.forEach((consumer) => {
        try { consumer.close(); } catch(e){}
      });
      producerToConsumerMapRef.current.clear();
      consumerToStreamMapRef.current.clear();
      setRemoteStreams(new Map());
      pendingProducersRef.current = [];

      console.log(`[Diagnostic] Emitting join-room. Room ID: ${sessionId} | Name: ${name}`);
      socketInstance.emit('join-room', { sessionId, name }, async (response: any) => {
        console.log(`[Diagnostic] join-room response received:`, response);
        if (response.error) {
          console.error('[Diagnostic] join-room error:', response.error);
          return;
        }

        try {
          let device = deviceRef.current;
          if (!device) {
            device = new mediasoupClient.Device();
            console.log(`[Diagnostic] Loading device with routerRtpCapabilities...`);
            await device.load({ routerRtpCapabilities: response.routerRtpCapabilities });
            deviceRef.current = device;
            console.log(`[Diagnostic] Device load success. Loaded = ${device.loaded}`);
          } else {
            console.log(`[Diagnostic] Device already loaded. Loaded = ${device.loaded}`);
          }
          
          updateDiagnostics();

          // Negotiate fresh transports
          await negotiateTransports(socketInstance);

          // Process existing producers returned by join-room (Step 5: receive all active producers)
          if (response.producers && response.producers.length > 0) {
            console.log(`[Diagnostic] Consuming ${response.producers.length} existing producers:`, response.producers);
            response.producers.forEach((p: any) => {
              consumeProducer(socketInstance, p);
            });
          }
        } catch (err) {
          console.warn('MediaSoup client load/negotiate failed.', err);
        }
      });
    };

    // STEP 1: Guard - prevent multiple getUserMedia calls
    const initMediaAndSocket = async () => {
      // STEP 1: If already initializing, skip entirely
      if (isInitializingRef.current) {
        console.warn(`[Diagnostic] initMediaAndSocket called but already initializing. SKIPPING.`);
        return;
      }
      isInitializingRef.current = true;
      getUserMediaCallCountRef.current++;
      console.log(`[Diagnostic] getUserMedia call #${getUserMediaCallCountRef.current}`);

      setMediaError(null);
      console.log(`[Diagnostic] window.isSecureContext:`, window.isSecureContext);
      
      // STEP 4: Log permissions if available
      if (typeof navigator !== 'undefined' && navigator.permissions && (navigator.permissions as any).query) {
        try {
          const camPerm = await navigator.permissions.query({ name: 'camera' as any });
          console.log(`[Diagnostic] Camera permission status:`, camPerm.state);
        } catch (e) {
          console.log(`[Diagnostic] Camera permission query failed:`, e);
        }
        try {
          const micPerm = await navigator.permissions.query({ name: 'microphone' as any });
          console.log(`[Diagnostic] Microphone permission status:`, micPerm.state);
        } catch (e) {
          console.log(`[Diagnostic] Microphone permission query failed:`, e);
        }
      }

      // STEP 5: Enumerate devices and populate state
      if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const cameras = devices.filter(d => d.kind === 'videoinput');
          const microphones = devices.filter(d => d.kind === 'audioinput');
          setAvailableDevices({ cameras, microphones });
          console.log(`[Diagnostic] Enumerated Devices: ${cameras.length} cameras, ${microphones.length} microphones`);
          devices.forEach(d => {
            console.log(`- DeviceID: ${d.deviceId} | Kind: ${d.kind} | Label: ${d.label || '(blocked)'}`);
          });
        } catch (err) {
          console.warn(`[Diagnostic] enumerateDevices failed:`, err);
        }
      }

      try {
        // STEP 7: Release old tracks before requesting new ones
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach(t => { t.stop(); console.log(`[Diagnostic] Stopped stale track: ${t.kind} (${t.label})`); });
          localStreamRef.current = null;
          setLocalStream(null);
        }

        // Build constraints with selected devices if available
        const audioConst: any = { ...audioConstraints };
        if (selectedMic) audioConst.deviceId = { exact: selectedMic };
        const videoConst: any = { width: 640, height: 480, frameRate: 24 };
        if (selectedCamera) videoConst.deviceId = { exact: selectedCamera };

        console.log(`[Diagnostic] Requesting getUserMedia...`);
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: audioConst,
          video: videoConst
        });

        // Step 1 - Local Media verification
        const audioTracks = stream.getAudioTracks();
        const videoTracks = stream.getVideoTracks();
        
        console.log(`[Diagnostic] Local Media Acquired:`, {
          audioTracksCount: audioTracks.length,
          videoTracksCount: videoTracks.length,
          audioTrackId: audioTracks[0]?.id,
          audioEnabled: audioTracks[0]?.enabled,
          audioReadyState: audioTracks[0]?.readyState,
          audioMuted: audioTracks[0]?.muted,
          audioLabel: audioTracks[0]?.label,
          videoTrackId: videoTracks[0]?.id,
          videoEnabled: videoTracks[0]?.enabled,
          videoReadyState: videoTracks[0]?.readyState,
          videoMuted: videoTracks[0]?.muted,
          videoLabel: videoTracks[0]?.label,
        });

        if (audioTracks.length === 0 || videoTracks.length === 0 || !audioTracks[0].enabled || audioTracks[0].readyState !== 'live' || !videoTracks[0].enabled || videoTracks[0].readyState !== 'live') {
          const errorMsg = `getUserMedia track verification failed: Audio tracks = ${audioTracks.length}, Video tracks = ${videoTracks.length}. Please check device connections.`;
          console.error(`[Diagnostic] ${errorMsg}`);
          setMediaError(errorMsg);
          isInitializingRef.current = false;
          return;
        }

        localStreamRef.current = stream;
        setLocalStream(stream);

        // STEP 5: Re-enumerate after getUserMedia for labels
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const cameras = devices.filter(d => d.kind === 'videoinput');
          const microphones = devices.filter(d => d.kind === 'audioinput');
          setAvailableDevices({ cameras, microphones });
        } catch (_) {}

        // Establish Socket connection (only one)
        if (socketRef.current) {
          console.warn(`[Diagnostic] Socket already exists. Disconnecting stale socket before creating new one.`);
          socketRef.current.disconnect();
          socketRef.current = null;
        }

        const socketUrl = SOCKET_BASE;
        const socketInstance = io(socketUrl, {
          auth: { token },
          transports: ['websocket'],
        });
        socketRef.current = socketInstance;
        setSocket(socketInstance);

        // Register socket listeners BEFORE join-room
        registerSocketListeners(socketInstance);

        // Listen for socket connection to join-room
        socketInstance.off('connect');
        socketInstance.on('connect', () => {
          console.log(`[Diagnostic] Socket connected/reconnected. ID: ${socketInstance.id}`);
          joinAndInitialize(socketInstance);
        });

        if (socketInstance.connected) {
          joinAndInitialize(socketInstance);
        }

        updateDiagnostics();
      } catch (err: any) {
        // STEP 4: Detailed error logging with err.name
        console.error('[Diagnostic] getUserMedia failed:', {
          name: err.name,
          message: err.message,
          constraint: err.constraint,
          stack: err.stack,
        });
        setMediaError(`${err.name || 'Error'}: ${err.message || err}. Please close other apps using your camera/mic and try again.`);
        setDiagnostics((prev: any) => ({ ...prev, errorName: err.name || '', errorMessage: err.message || '' }));
      } finally {
        isInitializingRef.current = false;
      }
    };

    initMediaAndSocketRef.current = initMediaAndSocket;
    initMediaAndSocket();

    // STEP 8: Cleanup on page refresh/close
    const handleBeforeUnload = () => {
      console.log('[Diagnostic] beforeunload: Stopping all tracks and closing connections.');
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
        localStreamRef.current = null;
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(t => t.stop());
        screenStreamRef.current = null;
      }
      if (sendTransportRef.current) { try { sendTransportRef.current.close(); } catch(e){} }
      if (recvTransportRef.current) { try { recvTransportRef.current.close(); } catch(e){} }
      if (socketRef.current) { socketRef.current.disconnect(); socketRef.current = null; }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    // STEP 2: Full cleanup on component unmount
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      initMediaAndSocketRef.current = null;
      isInitializingRef.current = false;
      console.log("[Diagnostic] Component unmounting. Running full WebRTC and Socket cleanup...");
      
      // Stop all local tracks
      const stream = localStreamRef.current;
      if (stream) {
        stream.getTracks().forEach(t => { t.stop(); console.log(`[Diagnostic] Cleanup: stopped ${t.kind} track`); });
        localStreamRef.current = null;
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(t => t.stop());
        screenStreamRef.current = null;
      }
      setLocalStream(null);
      
      // Close producers
      if (localAudioProducerRef.current) {
        try { localAudioProducerRef.current.close(); } catch(e){}
        localAudioProducerRef.current = null;
      }
      if (localVideoProducerRef.current) {
        try { localVideoProducerRef.current.close(); } catch(e){}
        localVideoProducerRef.current = null;
      }

      // Close consumers
      producerToConsumerMapRef.current.forEach((consumer) => {
        try { consumer.close(); } catch(e){}
      });
      producerToConsumerMapRef.current.clear();
      consumerToStreamMapRef.current.clear();

      activeConsumersRef.current.forEach(({ consumer }) => {
        try { consumer.close(); } catch(e){}
      });
      activeConsumersRef.current.clear();

      // Close transports
      if (sendTransportRef.current) {
        try { sendTransportRef.current.close(); } catch(e){}
        sendTransportRef.current = null;
      }
      if (recvTransportRef.current) {
        try { recvTransportRef.current.close(); } catch(e){}
        recvTransportRef.current = null;
      }

      // Disconnect socket and remove all listeners
      if (socketRef.current) {
        const socketInstance = socketRef.current;
        socketInstance.off('new-producer');
        socketInstance.off('producer-closed');
        socketInstance.off('participant-left');
        socketInstance.off('new-subtitle');
        socketInstance.off('session-ended');
        socketInstance.off('force-mute-mic');
        socketInstance.off('supervisor-takeover');
        socketInstance.off('private-note-message');
        socketInstance.off('connect');
        socketInstance.disconnect();
        socketRef.current = null;
      }
      setSocket(null);
    };
  }, [sessionId, role, router]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';

    rec.onresult = (event: any) => {
      const lastResult = event.results[event.results.length - 1];
      const text = lastResult[0].transcript.toLowerCase().trim();
      
      console.log(`[Voice Assistant] Heard speech input: "${text}"`);

      if (lastResult.isFinal) {
        if (text.includes('start recording')) {
          console.log('[Voice Assistant] Executing command: Start recording');
          startSessionRecording();
        } else if (text.includes('share screen')) {
          console.log('[Voice Assistant] Executing command: Share screen');
          toggleScreenShare();
        } else if (text.includes('mute microphone')) {
          console.log('[Voice Assistant] Executing command: Mute microphone');
          setMicEnabled(false);
          if (localStreamRef.current) {
            localStreamRef.current.getAudioTracks().forEach(t => t.enabled = false);
          }
        } else if (text.includes('end call') || text.includes('end session') || text.includes('leave session')) {
          console.log('[Voice Assistant] Executing command: End call');
          endSession();
        } else if (text.includes('open whiteboard')) {
          console.log('[Voice Assistant] Executing command: Open whiteboard');
          setActiveTab('whiteboard');
        } else if (text.includes('generate summary')) {
          console.log('[Voice Assistant] Executing command: Generate summary');
          fetch(`${API_BASE}/ai/session/${sessionId}/analyze`, {
            method: 'POST'
          }).then(() => alert('AI meeting summary and ticket generated successfully!')).catch(e => console.error(e));
        }
      }
    };

    rec.onend = () => {
      if (voiceAssistantActive) {
        try { rec.start(); } catch (e) {}
      }
    };

    recognitionRef.current = rec;

    if (voiceAssistantActive) {
      try { rec.start(); } catch (e) {}
    }

    return () => {
      try { rec.stop(); } catch(e){}
    };
  }, [voiceAssistantActive, sessionId] as any[]);

  useEffect(() => {
    const handleAutoplayBlocked = () => {
      console.log("[Diagnostic] Autoplay blocked event received.");
      setAutoplayBlocked(true);
    };
    window.addEventListener('autoplay-blocked', handleAutoplayBlocked);
    return () => window.removeEventListener('autoplay-blocked', handleAutoplayBlocked);
  }, []);

  useEffect(() => {
    const interval = setInterval(async () => {
      const sendT = sendTransportRef.current;
      const recvT = recvTransportRef.current;
      
      let bitrate = 0;
      let packetLoss = 0;
      let rtt = 0;
      
      if (sendT) {
        try {
          const stats = await sendT.getStats();
          stats.forEach((report: any) => {
            if (report.type === 'candidate-pair' && report.state === 'succeeded') {
              rtt = report.currentRoundTripTime * 1000 || rtt;
            }
            if (report.type === 'outbound-rtp') {
              bitrate += (report.bytesSent * 8) / 1000;
            }
          });
        } catch (err) {}
      }

      if (recvT) {
        try {
          const stats = await recvT.getStats();
          stats.forEach((report: any) => {
            if (report.type === 'inbound-rtp') {
              packetLoss = report.packetsLost / (report.packetsReceived + report.packetsLost) || packetLoss;
            }
          });
        } catch (err) {}
      }

      setDiagnostics((prev: any) => ({
        ...prev,
        bitrate: Math.round(bitrate) % 2000,
        packetLoss,
        rtt: Math.round(rtt)
      }));
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const toggleMic = useCallback(() => {
    setMicEnabled(prev => {
      const nextVal = !prev;
      const stream = localStreamRef.current;
      if (stream) {
        stream.getAudioTracks().forEach(track => {
          track.enabled = nextVal;
        });
      }
      return nextVal;
    });
  }, []);

  const toggleCam = useCallback(() => {
    setCamEnabled(prev => {
      const nextVal = !prev;
      const stream = localStreamRef.current;
      if (stream) {
        stream.getVideoTracks().forEach(track => {
          track.enabled = nextVal;
        });
      }
      return nextVal;
    });
  }, []);

  const stopScreenShare = useCallback(async () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
    }

    try {
      const camStream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, frameRate: 24 } });
      const camTrack = camStream.getVideoTracks()[0];

      if (localVideoProducerRef.current) {
        await localVideoProducerRef.current.replaceTrack({ track: camTrack });
      }

      if (localStreamRef.current) {
        const currentVideoTrack = localStreamRef.current.getVideoTracks()[0];
        if (currentVideoTrack) {
          localStreamRef.current.removeTrack(currentVideoTrack);
          currentVideoTrack.stop();
        }
        localStreamRef.current.addTrack(camTrack);
        setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
      }
    } catch (err) {
      console.error("Re-acquiring camera track failed:", err);
    }
    setScreenSharing(false);
    socket?.emit('screen-share-toggle', { started: false });
  }, [socket]);

  const toggleScreenShare = useCallback(async () => {
    if (!screenSharing) {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenStreamRef.current = stream;
        const screenTrack = stream.getVideoTracks()[0];

        if (localVideoProducerRef.current) {
          await localVideoProducerRef.current.replaceTrack({ track: screenTrack });
        }

        screenTrack.onended = () => {
          stopScreenShare();
        };

        setScreenSharing(true);
        socket?.emit('screen-share-toggle', { started: true });
        if (localStreamRef.current) {
          const localVideoTrack = localStreamRef.current.getVideoTracks()[0];
          if (localVideoTrack) {
            localStreamRef.current.removeTrack(localVideoTrack);
          }
          localStreamRef.current.addTrack(screenTrack);
          setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
        }
      } catch (err) {
        console.error("Screen share failed:", err);
      }
    } else {
      await stopScreenShare();
    }
  }, [screenSharing, socket, stopScreenShare]);

  const updateAudioConstraints = useCallback((key: string, val: boolean) => {
    setAudioConstraints(prev => ({ ...prev, [key]: val }));
    const stream = localStreamRef.current;
    if (stream) {
      stream.getAudioTracks().forEach(track => {
        track.applyConstraints({ [key]: val });
      });
    }
  }, []);

  // Recording Controls
  const startSessionRecording = async () => {
    try {
      const producers = [];
      if (localAudioProducerRef.current) {
        producers.push({ producerId: localAudioProducerRef.current.id, kind: 'audio' });
      }
      if (localVideoProducerRef.current) {
        producers.push({ producerId: localVideoProducerRef.current.id, kind: 'video' });
      }

      const res = await fetch(`${API_BASE}/session/record/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ sessionId, producers }),
      });
      if (res.ok) {
        setRecordingState('recording');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const stopSessionRecording = async () => {
    try {
      setRecordingState('processing');
      const res = await fetch(`${API_BASE}/session/record/stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ sessionId }),
      });
      if (res.ok) {
        setRecordingState('idle');
        alert('Recording saved to MinIO object storage successfully!');
      }
    } catch (err) {
      setRecordingState('idle');
    }
  };

  const endSession = async () => {
    if (role === 'agent' || role === 'supervisor') {
      try {
        await fetch(`${API_BASE}/session/end`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}` 
          },
          body: JSON.stringify({ sessionId })
        });
      } catch (err) {
        console.error('Failed to end session', err);
      }
      logout();
      router.push('/dashboard');
    } else {
      setShowCsatModal(true);
    }
  };

  if (!role) {
    return (
      <CustomerJoinNameForm 
        sessionId={sessionId} 
        inviteToken={inviteToken || ''} 
        setAuth={setAuth} 
        setSession={setSession} 
        onJoinSuccess={(token: string) => setPortalToken(token)}
      />
    );
  }

  if (mediaError) {
    return (
      <div className="min-h-screen bg-[#04020a] text-white flex items-center justify-center p-4 grid-dots relative overflow-hidden select-none">
        <div className="absolute inset-0 bg-[#0c0202]/20 z-0 pointer-events-none" />
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="z-10 max-w-md w-full p-8 border border-red-500/20 bg-red-950/20 glass-panel rounded-3xl text-center shadow-2xl flex flex-col items-center backdrop-blur-md"
        >
          <div className="w-16 h-16 rounded-full border border-red-500/30 flex items-center justify-center mb-4 text-red-400 bg-red-950/20 shadow-lg shadow-red-500/10">
            <ShieldAlert size={28} className="animate-pulse" />
          </div>
          <h2 className="text-2xl font-cyber font-extrabold text-red-400 mb-2">Media Access Error</h2>
          <p className="text-xs text-gray-400 font-mono mb-6 leading-relaxed bg-black/40 border border-white/5 p-4 rounded-xl text-left w-full max-h-40 overflow-y-auto">{mediaError}</p>
          <div className="flex gap-4 w-full">
            <motion.button 
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.96 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              onClick={() => {
                if (initMediaAndSocketRef.current) {
                  initMediaAndSocketRef.current();
                } else {
                  window.location.reload();
                }
              }}
              className="flex-1 py-3.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-cyber font-bold text-xs uppercase tracking-wider transition duration-200"
            >
              Retry Access
            </motion.button>
            <motion.button 
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.96 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              onClick={() => window.location.reload()}
              className="flex-1 py-3.5 bg-zinc-800 hover:bg-zinc-700 text-white border border-white/10 rounded-xl font-cyber font-bold text-xs uppercase tracking-wider transition duration-200"
            >
              Reload Page
            </motion.button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.25, ease: "easeInOut" }}
      className="min-h-screen bg-[#04020a] text-white flex flex-col grid-dots overflow-hidden w-full"
    >
      {/* Top Header */}
      <header className="flex flex-col md:flex-row gap-3 md:gap-0 justify-between items-center p-4 bg-black/60 border-b border-white/10 backdrop-blur select-none">
        <div className="flex items-center space-x-3 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-purple-400 animate-pulse" />
            <h1 className="font-extrabold text-sm sm:text-lg bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400 font-cyber">
              VisionSupport AI
            </h1>
          </div>
          <span className="text-[10px] text-gray-500 font-mono bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">
            Session: {sessionId?.substring(0,8)}...
          </span>
        </div>
        
        {/* Subtitle Teleprompter banner */}
        {subtitle && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="hidden md:block px-6 py-2 bg-purple-950/40 border border-purple-500/30 rounded-xl text-xs text-purple-200 italic font-medium max-w-md truncate"
          >
            {subtitle}
          </motion.div>
        )}

        <div className="flex flex-wrap items-center justify-center md:justify-end gap-2 md:space-x-4 w-full md:w-auto">
          <span className="text-xs text-purple-400 font-mono capitalize hidden sm:inline">{role}</span>
          
          {/* Diagnostics HUD Toggle */}
          <motion.button 
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.96 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            onClick={() => setShowDiagnostics(!showDiagnostics)}
            className="bg-purple-950/40 border border-purple-500/30 text-purple-400 hover:bg-purple-900/20 text-xs px-3.5 py-1.5 rounded-lg font-bold transition font-cyber flex items-center gap-1.5"
          >
            <Activity className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Diagnostics HUD</span>
            <span className="sm:hidden">HUD</span>
          </motion.button>

          {/* Voice Command Button */}
          {(role === 'agent' || role === 'supervisor') && (
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.96 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              onClick={() => {
                const nextVal = !voiceAssistantActive;
                setVoiceAssistantActive(nextVal);
              }}
              className={`px-3 py-1.5 rounded-lg font-bold text-xs transition duration-200 flex items-center gap-1.5 font-cyber ${
                voiceAssistantActive
                  ? 'bg-green-600 text-white animate-pulse shadow-lg shadow-green-500/20'
                  : 'bg-purple-950/40 border border-purple-500/30 text-purple-400 hover:bg-purple-900/20'
              }`}
              title="Enable Voice Commands Assistant"
            >
              <Mic className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Voice Copilot</span>
              <span className="sm:hidden">Copilot</span>
            </motion.button>
          )}

          {/* Recording buttons (Agent/Supervisor only) */}
          {(role === 'agent' || role === 'supervisor') && (
            <div className="flex items-center space-x-2 border-r border-white/10 pr-2 md:pr-4">
              {recordingState === 'idle' ? (
                <motion.button 
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.96 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  onClick={startSessionRecording}
                  className="px-3 py-1.5 bg-red-950/20 border border-red-500/30 text-red-400 hover:bg-red-900/20 text-xs rounded-lg font-bold flex items-center gap-1.5 transition"
                >
                  <Play size={12} />
                  <span className="hidden sm:inline">Record</span>
                  <span className="sm:hidden">Rec</span>
                </motion.button>
              ) : recordingState === 'recording' ? (
                <motion.button 
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.96 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  onClick={stopSessionRecording}
                  className="px-3 py-1.5 bg-red-600 text-white text-xs rounded-lg font-bold flex items-center gap-1.5 transition animate-pulse"
                >
                  <Square size={12} />
                  <span className="hidden sm:inline">Stop</span>
                  <span className="sm:hidden">Stop</span>
                </motion.button>
              ) : (
                <span className="text-xs text-gray-500 font-mono flex items-center gap-1">
                  <Settings className="w-3.5 h-3.5 animate-spin" />
                  <span className="hidden sm:inline">Processing</span>
                </span>
              )}
            </div>
          )}

          <motion.button 
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.96 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            onClick={endSession}
            className="bg-red-900/20 border border-red-500/30 text-red-400 hover:bg-red-800/20 text-xs px-4 py-2 rounded-lg font-bold transition"
          >
            {role === 'agent' || role === 'supervisor' ? (
              <>
                <span className="hidden sm:inline">End Session</span>
                <span className="sm:hidden">End</span>
              </>
            ) : (
              <>
                <span className="hidden sm:inline">Leave Session</span>
                <span className="sm:hidden">Leave</span>
              </>
            )}
          </motion.button>
        </div>
      </header>

      {/* Main body split */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Mobile Tabs bar */}
        <div className="flex lg:hidden bg-white/5 border border-white/10 p-1.5 rounded-xl mx-4 mt-4 select-none text-xs font-cyber font-bold space-x-1 shrink-0 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('video')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg transition whitespace-nowrap ${activeTab === 'video' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            <Tv size={14} /> Streams
          </button>
          <button
            onClick={() => setActiveTab('whiteboard')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg transition whitespace-nowrap ${activeTab === 'whiteboard' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            <Edit2 size={14} /> Board
          </button>
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg transition whitespace-nowrap ${activeTab === 'chat' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            <MessageSquare size={14} /> Chat
          </button>
          <button
            onClick={() => setActiveTab('files')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg transition whitespace-nowrap ${activeTab === 'files' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            <FileText size={14} /> Repository
          </button>
          <button
            onClick={() => setActiveTab('ai')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg transition whitespace-nowrap ${activeTab === 'ai' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            <Sparkles size={14} /> AI
          </button>
        </div>

        {/* Left Column: Feeds & Canvas */}
        <div className="flex-1 flex flex-col p-4 space-y-4 overflow-hidden">
          {/* Desktop Tabs bar */}
          <div className="hidden lg:flex bg-white/5 border border-white/10 p-1.5 rounded-xl self-start space-x-2 select-none text-xs font-cyber font-bold">
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.96 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              onClick={() => setActiveTab('video')}
              className={`px-4 py-1.5 rounded-lg transition ${activeTab !== 'whiteboard' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              Streams View
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.96 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              onClick={() => setActiveTab('whiteboard')}
              className={`px-4 py-1.5 rounded-lg transition ${activeTab === 'whiteboard' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              Collaborative Whiteboard
            </motion.button>
          </div>

          <div className="flex-1 overflow-hidden">
            {/* Desktop layout: left column contains video or whiteboard */}
            <div className="hidden lg:block h-full">
              {activeTab === 'whiteboard' ? (
                <Whiteboard socket={socket} sessionId={sessionId} />
              ) : (
                <VideoGrid
                  localStream={localStream}
                  remoteStreams={remoteStreams}
                  micEnabled={micEnabled}
                  camEnabled={camEnabled}
                  toggleMic={toggleMic}
                  toggleCam={toggleCam}
                  audioConstraints={audioConstraints}
                  updateAudioConstraints={updateAudioConstraints}
                  screenSharing={screenSharing}
                  toggleScreenShare={toggleScreenShare}
                  socket={socket}
                />
              )}
            </div>

            {/* Mobile layout: content displays active tab */}
            <div className="block lg:hidden h-full">
              {activeTab === 'video' && (
                <VideoGrid
                  localStream={localStream}
                  remoteStreams={remoteStreams}
                  micEnabled={micEnabled}
                  camEnabled={camEnabled}
                  toggleMic={toggleMic}
                  toggleCam={toggleCam}
                  audioConstraints={audioConstraints}
                  updateAudioConstraints={updateAudioConstraints}
                  screenSharing={screenSharing}
                  toggleScreenShare={toggleScreenShare}
                  socket={socket}
                />
              )}
              {activeTab === 'whiteboard' && (
                <Whiteboard socket={socket} sessionId={sessionId} />
              )}
              {activeTab === 'chat' && (
                <Chat socket={socket} sessionId={sessionId} />
              )}
              {activeTab === 'files' && (
                <FileShare sessionId={sessionId} />
              )}
              {activeTab === 'ai' && (
                <AIAssistantPanel sessionId={sessionId} transcripts={transcripts} />
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Chat & Repository Drawer (Desktop Only) */}
        <div className="hidden lg:flex w-96 border-l border-white/10 p-4 flex-col space-y-4 bg-black/25">
          <div className="flex border-b border-white/10 pb-2 select-none space-x-4 text-xs font-cyber font-cyber font-bold">
            <button
              onClick={() => setActiveTab('chat')}
              className={`pb-1 border-b-2 transition ${activeTab === 'chat' ? 'border-purple-500 text-purple-400' : 'border-transparent text-gray-500'}`}
            >
              <MessageSquare size={14} className="inline mr-1" /> Discussion
            </button>
            <button
              onClick={() => setActiveTab('files')}
              className={`pb-1 border-b-2 transition ${activeTab === 'files' ? 'border-purple-500 text-purple-400' : 'border-transparent text-gray-500'}`}
            >
              <FileText size={14} className="inline mr-1" /> Repository
            </button>
            <button
              onClick={() => setActiveTab('ai')}
              className={`pb-1 border-b-2 transition ${activeTab === 'ai' ? 'border-purple-500 text-purple-400' : 'border-transparent text-gray-500'}`}
            >
              <Sparkles size={14} className="inline mr-1" /> AI Assistant
            </button>
          </div>

          <div className="flex-1 overflow-hidden">
            {activeTab === 'chat' || activeTab === 'video' || activeTab === 'whiteboard' ? (
              <Chat socket={socket} sessionId={sessionId} />
            ) : activeTab === 'files' ? (
              <FileShare sessionId={sessionId} />
            ) : (
              <AIAssistantPanel sessionId={sessionId} transcripts={transcripts} />
            )}
          </div>
        </div>
      </div>
      
      {autoplayBlocked && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-50 bg-purple-950/90 border-2 border-purple-500/50 p-5 rounded-3xl flex flex-col items-center gap-3.5 backdrop-blur-md shadow-2xl animate-pulse">
          <p className="text-xs font-semibold text-purple-200 uppercase tracking-widest font-cyber">Autoplay Blocked</p>
          <p className="text-[10px] text-gray-400 text-center max-w-xs">The browser blocked remote audio stream autoplay. Click below to initialize audio tracks.</p>
          <button
            onClick={() => {
              setAutoplayBlocked(false);
              document.querySelectorAll('video, audio').forEach((el: any) => {
                el.play().catch((e: any) => console.error("Autoplay recovery failed:", e));
              });
            }}
            className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl text-xs font-extrabold tracking-wide uppercase transition shadow-lg shadow-purple-500/20"
          >
            ✕ Enable Remote Audio
          </button>
        </div>
      )}

      {showDiagnostics && (
        <div className="absolute right-2 sm:right-4 bottom-2 sm:bottom-4 w-[calc(100vw-1rem)] sm:w-[420px] p-5 bg-[#080512]/95 border border-purple-500/30 rounded-3xl shadow-2xl z-50 text-[10px] font-mono text-gray-300 space-y-4 max-h-[80vh] overflow-y-auto backdrop-blur-lg select-none border-t-2 border-t-purple-500/70">
          <div className="flex justify-between items-center border-b border-white/10 pb-2">
            <h3 className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 uppercase tracking-widest font-cyber">Diagnostics Terminal</h3>
            <button onClick={() => setShowDiagnostics(false)} className="text-gray-500 hover:text-white transition font-bold text-xs">✕</button>
          </div>

          {/* STEP 9: Device & Track State */}
          <div className="space-y-1.5 bg-white/5 p-3 rounded-2xl border border-white/5">
            <h4 className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider font-cyber mb-1">📷 Camera & 🎤 Mic State</h4>
            <div className="grid grid-cols-2 gap-2">
              <div>Camera: <span className={diagnostics.cameraState === 'active' ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>{diagnostics.cameraState?.toUpperCase()}</span></div>
              <div>Mic: <span className={diagnostics.micState === 'active' ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>{diagnostics.micState?.toUpperCase()}</span></div>
              <div>Video Track: <span className={diagnostics.videoTrackReadyState === 'live' ? 'text-green-400' : 'text-red-400'}>{diagnostics.videoTrackReadyState}</span></div>
              <div>Audio Track: <span className={diagnostics.audioTrackReadyState === 'live' ? 'text-green-400' : 'text-red-400'}>{diagnostics.audioTrackReadyState}</span></div>
              <div className="col-span-2 truncate">Cam Device: <span className="text-cyan-400">{diagnostics.currentCameraDevice}</span></div>
              <div className="col-span-2 truncate">Mic Device: <span className="text-cyan-400">{diagnostics.currentMicDevice}</span></div>
            </div>
          </div>

          {/* STEP 9: Guard Counters */}
          <div className="grid grid-cols-3 gap-2 bg-white/5 p-3 rounded-2xl border border-white/5">
            <div>getUserMedia calls: <span className={diagnostics.getUserMediaCallCount > 1 ? 'text-red-400 font-bold' : 'text-green-400 font-bold'}>{diagnostics.getUserMediaCallCount}</span></div>
            <div>Sockets: <span className={diagnostics.socketCount > 1 ? 'text-red-400 font-bold' : 'text-green-400 font-bold'}>{diagnostics.socketCount}</span></div>
            <div>Streams: <span className={diagnostics.localStreamCount > 1 ? 'text-red-400 font-bold' : 'text-green-400 font-bold'}>{diagnostics.localStreamCount}</span></div>
          </div>

          {/* Error State */}
          {(diagnostics.errorName || diagnostics.errorMessage) && (
            <div className="bg-red-950/30 border border-red-500/30 p-3 rounded-2xl">
              <h4 className="text-[10px] font-extrabold text-red-400 uppercase tracking-wider font-cyber mb-1">⚠ Last Error</h4>
              <div>Name: <span className="text-red-300 font-bold">{diagnostics.errorName}</span></div>
              <div>Message: <span className="text-red-300">{diagnostics.errorMessage}</span></div>
            </div>
          )}
          
          {/* STEP 6: Device Switching */}
          <div className="space-y-2 bg-white/5 p-3 rounded-2xl border border-white/5">
            <h4 className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider font-cyber">🔄 Device Switching</h4>
            {availableDevices.cameras.length > 0 && (
              <div>
                <label className="text-[9px] text-gray-500 block mb-1">Camera:</label>
                <select
                  value={selectedCamera}
                  onChange={async (e) => {
                    const deviceId = e.target.value;
                    setSelectedCamera(deviceId);
                    // Hot-switch video track
                    if (localStreamRef.current && deviceId) {
                      try {
                        const newStream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: deviceId }, width: 640, height: 480, frameRate: 24 } });
                        const newTrack = newStream.getVideoTracks()[0];
                        const oldTrack = localStreamRef.current.getVideoTracks()[0];
                        if (oldTrack) { localStreamRef.current.removeTrack(oldTrack); oldTrack.stop(); }
                        localStreamRef.current.addTrack(newTrack);
                        if (localVideoProducerRef.current) await localVideoProducerRef.current.replaceTrack({ track: newTrack });
                        setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
                        updateDiagnostics();
                      } catch (err: any) { console.error('[Diagnostic] Camera switch failed:', err.name, err.message); }
                    }
                  }}
                  className="w-full bg-black/60 border border-white/10 rounded-lg px-2 py-1 text-[9px] text-gray-200 focus:outline-none focus:border-purple-500"
                >
                  <option value="">Default Camera</option>
                  {availableDevices.cameras.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${d.deviceId.substring(0,8)}`}</option>)}
                </select>
              </div>
            )}
            {availableDevices.microphones.length > 0 && (
              <div>
                <label className="text-[9px] text-gray-500 block mb-1">Microphone:</label>
                <select
                  value={selectedMic}
                  onChange={async (e) => {
                    const deviceId = e.target.value;
                    setSelectedMic(deviceId);
                    // Hot-switch audio track
                    if (localStreamRef.current && deviceId) {
                      try {
                        const newStream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: deviceId }, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
                        const newTrack = newStream.getAudioTracks()[0];
                        const oldTrack = localStreamRef.current.getAudioTracks()[0];
                        if (oldTrack) { localStreamRef.current.removeTrack(oldTrack); oldTrack.stop(); }
                        localStreamRef.current.addTrack(newTrack);
                        if (localAudioProducerRef.current) await localAudioProducerRef.current.replaceTrack({ track: newTrack });
                        setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
                        updateDiagnostics();
                      } catch (err: any) { console.error('[Diagnostic] Mic switch failed:', err.name, err.message); }
                    }
                  }}
                  className="w-full bg-black/60 border border-white/10 rounded-lg px-2 py-1 text-[9px] text-gray-200 focus:outline-none focus:border-purple-500"
                >
                  <option value="">Default Microphone</option>
                  {availableDevices.microphones.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `Mic ${d.deviceId.substring(0,8)}`}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* Network Stats */}
          <div className="grid grid-cols-2 gap-3 bg-white/5 p-3 rounded-2xl border border-white/5">
            <div>Device: <span className={diagnostics.deviceLoaded ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>{diagnostics.deviceLoaded ? 'LOADED' : 'UNLOADED'}</span></div>
            <div>RTT / Latency: <span className="text-purple-400 font-bold">{diagnostics.rtt} ms</span></div>
            <div>Packet Loss: <span className="text-purple-400 font-bold">{(diagnostics.packetLoss * 100).toFixed(2)}%</span></div>
            <div>Bitrate: <span className="text-purple-400 font-bold">{diagnostics.bitrate} kbps</span></div>
            <div className="col-span-2">Send Transport State: <span className="text-blue-400 font-bold uppercase">{diagnostics.sendTransportState}</span></div>
            <div className="col-span-2">Recv Transport State: <span className="text-blue-400 font-bold uppercase">{diagnostics.recvTransportState}</span></div>
          </div>

          <div className="space-y-2">
            <h4 className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider font-cyber">Local Producers ({diagnostics.producers.length})</h4>
            {diagnostics.producers.length === 0 ? (
              <div className="text-gray-600 text-[9px] italic">No active local producers.</div>
            ) : (
              diagnostics.producers.map((p: any) => (
                <div key={p.id} className="bg-white/5 px-3 py-1.5 rounded-xl border border-white/5 flex justify-between items-center">
                  <span className="font-bold text-blue-400 uppercase text-[9px]">{p.kind}</span>
                  <span className="text-[8px] text-gray-500 font-mono">{p.id}</span>
                </div>
              ))
            )}
          </div>

          <div className="space-y-2">
            <h4 className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider font-cyber">Remote Consumers ({diagnostics.consumers.length})</h4>
            {diagnostics.consumers.length === 0 ? (
              <div className="text-gray-600 text-[9px] italic">No active remote consumers.</div>
            ) : (
              diagnostics.consumers.map((c: any) => (
                <div key={c.id} className="bg-white/5 p-3 rounded-xl border border-white/5 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-purple-400 uppercase text-[9px]">{c.owner} ({c.kind})</span>
                    <span className="text-[8px] text-gray-500 font-mono">{c.id.substring(0,8)}...</span>
                  </div>
                  <div className="flex justify-between text-[8px] text-gray-500 font-mono">
                    <span>ReadyState: <span className="text-green-400">{c.trackState}</span></span>
                    <span>Enabled: <span className="text-blue-400">{c.trackEnabled ? 'YES' : 'NO'}</span></span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {showCsatModal && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[100] select-none">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-md w-full p-8 border border-white/10 glass-panel rounded-3xl text-center shadow-2xl space-y-6 bg-black/60 relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-purple-950/20 via-transparent to-blue-950/20 pointer-events-none" />
            
            <div className="w-16 h-16 rounded-full border border-purple-500/30 flex items-center justify-center mx-auto text-purple-400 bg-purple-950/20">
              <Star size={28} className="animate-pulse fill-purple-400" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-indigo-500 font-cyber">
                Rate Your Experience
              </h2>
              <p className="text-xs text-gray-400 leading-relaxed font-mono">
                Thank you for using VisionSupport AI. Please take a moment to rate the service provided by the agent.
              </p>
            </div>

            {/* Stars Selector */}
            <div className="flex justify-center items-center space-x-2.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setCsatRating(star)}
                  className="p-1 hover:scale-125 transition duration-200 focus:outline-none animate-pulse"
                >
                  <Star
                    size={32}
                    className={`transition duration-200 ${
                      star <= csatRating
                        ? 'text-yellow-400 fill-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]'
                        : 'text-gray-600 hover:text-yellow-400'
                    }`}
                  />
                </button>
              ))}
            </div>

            {/* Feedback input */}
            <div className="space-y-1.5 text-left">
              <label className="text-[10px] uppercase text-gray-500 font-mono block ml-1">
                Additional Comments (Optional)
              </label>
              <textarea
                value={csatFeedback}
                onChange={(e) => setCsatFeedback(e.target.value)}
                placeholder="What did we do well or how can we improve?"
                rows={3}
                disabled={submittingCsat}
                className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-xs focus:outline-none focus:border-purple-500 text-white placeholder-gray-600 resize-none font-sans"
              />
            </div>

            {/* Action buttons */}
            <div className="space-y-3">
              <button
                onClick={async () => {
                  setSubmittingCsat(true);
                  let finalToken = portalToken;
                  try {
                    const res = await fetch(`${API_BASE}/session/${sessionId}/csat`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ rating: csatRating, feedback: csatFeedback })
                    });
                    if (res.ok) {
                      const resData = await res.json();
                      if (resData.portalToken) {
                        finalToken = resData.portalToken;
                      }
                    }
                  } catch (e) {
                    console.error("CSAT submission failed:", e);
                  }
                  logout();
                  if (finalToken) {
                    router.push(`/portal/${finalToken}`);
                  } else {
                    router.push('/');
                  }
                }}
                disabled={submittingCsat}
                className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 text-white rounded-xl font-bold text-sm tracking-wide uppercase transition shadow-lg shadow-purple-500/10 font-cyber animate-pulse"
              >
                {submittingCsat ? 'Submitting...' : 'Submit Feedback'}
              </button>

              <button
                onClick={() => {
                  logout();
                  if (portalToken) {
                    router.push(`/portal/${portalToken}`);
                  } else {
                    router.push('/');
                  }
                }}
                disabled={submittingCsat}
                className="text-xs text-gray-500 hover:text-white transition font-mono block mx-auto underline"
              >
                Skip & Exit
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}

function CustomerJoinNameForm({ sessionId, inviteToken, setAuth, setSession, onJoinSuccess }: {
  sessionId: string;
  inviteToken: string;
  setAuth: any;
  setSession: any;
  onJoinSuccess: (portalToken: string) => void;
}) {
  const [customerName, setCustomerName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || loading) return;
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_BASE}/session/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inviteToken,
          role: 'customer',
          name: customerName.trim()
        })
      });

      const data = await res.json();
      setLoading(false);

      if (res.ok) {
        setAuth('customer-token-placeholder', 'customer', data.name);
        setSession(data.sessionId);
        if (data.portalToken) {
          onJoinSuccess(data.portalToken);
        }
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
          VisionSupport AI Secure Tunnel
        </p>

        {error && (
          <p className="text-red-400 text-xs font-mono mb-4 text-center p-2 bg-red-950/20 border border-red-500/20 rounded-lg w-full">
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

export default function SessionRoom() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#04020a] flex items-center justify-center text-purple-400 font-cyber animate-pulse">
        Initializing Secure Connection...
      </div>
    }>
      <SessionRoomInner />
    </Suspense>
  );
}
