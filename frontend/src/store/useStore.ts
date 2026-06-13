import { create } from 'zustand';

export interface MessagePayload {
  _id: string;
  senderId: string;
  senderName: string;
  senderRole: 'agent' | 'customer' | 'supervisor' | 'observer';
  text: string;
  timestamp: string;
  reactions?: Array<{ userId: string; emoji: string }>;
}

export interface WhiteboardElement {
  id: string;
  type: 'pencil' | 'rectangle' | 'circle' | 'line' | 'text' | 'sticky';
  points?: Array<{ x: number; y: number }>;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  color: string;
  lineWidth: number;
  text?: string;
  createdBy?: string;
}

export interface RemoteCursor {
  userId: string;
  name: string;
  x: number;
  y: number;
}

export interface ParticipantQuality {
  userId: string;
  name: string;
  role: string;
  bitrate: number;
  packetLoss: number;
  latency: number;
}

interface UserState {
  // Authentication
  token: string | null;
  role: 'agent' | 'customer' | 'supervisor' | 'observer' | null;
  name: string | null;
  email: string | null;
  companyName: string | null;
  profilePhoto: string | null;
  language: string | null;
  darkMode: boolean | null;
  notificationPreferences: { email: boolean; push: boolean } | null;
  csrfToken: string | null;
  
  // Call Session
  sessionId: string | null;
  inviteLink: string | null;
  
  // States
  recordingState: 'idle' | 'recording' | 'paused' | 'processing' | 'ready';
  recordingId: string | null;
  timelineMarkers: Array<{ time: number; type: string; description: string }>;
  
  // Real-time Feeds
  messages: MessagePayload[];
  unreadCount: number;
  whiteboardElements: WhiteboardElement[];
  participants: ParticipantQuality[];
  remoteCursors: RemoteCursor[];
  privateNotes: Array<{ senderName: string; note: string; timestamp: string }>;
  subtitleText: { speaker: string; text: string } | null;

  // Actions
  setAuth: (
    token: string, 
    role: 'agent' | 'customer' | 'supervisor' | 'observer', 
    name?: string, 
    email?: string,
    companyName?: string,
    profilePhoto?: string,
    language?: string,
    darkMode?: boolean,
    notificationPreferences?: any
  ) => void;
  setCsrfToken: (token: string | null) => void;
  setSession: (sessionId: string, inviteLink?: string | null) => void;
  setRecordingState: (state: 'idle' | 'recording' | 'paused' | 'processing' | 'ready', recordingId?: string | null) => void;
  addMessage: (msg: MessagePayload) => void;
  setMessages: (messages: MessagePayload[]) => void;
  clearMessages: () => void;
  incrementUnread: () => void;
  clearUnread: () => void;
  setWhiteboardElements: (elements: WhiteboardElement[]) => void;
  addWhiteboardElement: (elem: WhiteboardElement) => void;
  setParticipants: (list: ParticipantQuality[]) => void;
  updateParticipantQuality: (userId: string, data: Partial<ParticipantQuality>) => void;
  updateRemoteCursor: (cursor: RemoteCursor) => void;
  removeRemoteCursor: (userId: string) => void;
  addPrivateNote: (note: { senderName: string; note: string; timestamp: string }) => void;
  setSubtitle: (subtitle: { speaker: string; text: string } | null) => void;
  addTimelineMarker: (marker: { time: number; type: string; description: string }) => void;
  logout: () => void;
}

export const useStore = create<UserState>((set) => ({
  token: null,
  role: null,
  name: null,
  email: null,
  companyName: null,
  profilePhoto: null,
  language: 'en',
  darkMode: true,
  notificationPreferences: { email: true, push: true },
  csrfToken: null,
  sessionId: null,
  inviteLink: null,
  recordingState: 'idle',
  recordingId: null,
  timelineMarkers: [],
  messages: [],
  unreadCount: 0,
  whiteboardElements: [],
  participants: [],
  remoteCursors: [],
  privateNotes: [],
  subtitleText: null,

  setAuth: (token, role, name = 'User Guest', email = '', companyName = '', profilePhoto = '', language = 'en', darkMode = true, notificationPreferences = { email: true, push: true }) => 
    set({ token, role, name, email, companyName, profilePhoto, language, darkMode, notificationPreferences }),
  setCsrfToken: (csrfToken) => set({ csrfToken }),
  setSession: (sessionId, inviteLink = null) => set({ sessionId, inviteLink }),
  setRecordingState: (recordingState, recordingId = null) => set({ recordingState, recordingId }),
  addMessage: (msg) => set((state) => ({ 
    messages: [...state.messages, msg],
    unreadCount: state.unreadCount + 1
  })),
  setMessages: (messages) => set({ messages }),
  clearMessages: () => set({ messages: [], unreadCount: 0 }),
  incrementUnread: () => set((state) => ({ unreadCount: state.unreadCount + 1 })),
  clearUnread: () => set({ unreadCount: 0 }),
  
  setWhiteboardElements: (whiteboardElements) => set({ whiteboardElements }),
  addWhiteboardElement: (elem) => set((state) => ({ 
    whiteboardElements: [...state.whiteboardElements, elem] 
  })),
  
  setParticipants: (participants) => set({ participants }),
  updateParticipantQuality: (userId, data) => set((state) => ({
    participants: state.participants.map(p => p.userId === userId ? { ...p, ...data } : p)
  })),
  
  updateRemoteCursor: (cursor) => set((state) => {
    const idx = state.remoteCursors.findIndex(c => c.userId === cursor.userId);
    if (idx !== -1) {
      const copy = [...state.remoteCursors];
      copy[idx] = cursor;
      return { remoteCursors: copy };
    }
    return { remoteCursors: [...state.remoteCursors, cursor] };
  }),
  removeRemoteCursor: (userId) => set((state) => ({
    remoteCursors: state.remoteCursors.filter(c => c.userId !== userId)
  })),
  
  addPrivateNote: (note) => set((state) => ({ privateNotes: [...state.privateNotes, note] })),
  setSubtitle: (subtitleText) => set({ subtitleText }),
  addTimelineMarker: (marker) => set((state) => ({ timelineMarkers: [...state.timelineMarkers, marker] })),
  
  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('vs_auth_token');
      localStorage.removeItem('vs_auth_role');
      localStorage.removeItem('vs_auth_name');
      localStorage.removeItem('vs_auth_email');
      localStorage.removeItem('vs_auth_company');
      localStorage.removeItem('vs_auth_photo');
      localStorage.removeItem('vs_auth_lang');
      localStorage.removeItem('vs_auth_dark');
      localStorage.removeItem('vs_auth_notif');

      sessionStorage.removeItem('vs_auth_token');
      sessionStorage.removeItem('vs_auth_role');
      sessionStorage.removeItem('vs_auth_name');
      sessionStorage.removeItem('vs_auth_email');
      sessionStorage.removeItem('vs_auth_company');
      sessionStorage.removeItem('vs_auth_photo');
      sessionStorage.removeItem('vs_auth_lang');
      sessionStorage.removeItem('vs_auth_dark');
      sessionStorage.removeItem('vs_auth_notif');
    }
    set({
      token: null,
      role: null,
      name: null,
      email: null,
      companyName: null,
      profilePhoto: null,
      language: 'en',
      darkMode: true,
      notificationPreferences: { email: true, push: true },
      csrfToken: null,
      sessionId: null,
      inviteLink: null,
      recordingState: 'idle',
      recordingId: null,
      timelineMarkers: [],
      messages: [],
      unreadCount: 0,
      whiteboardElements: [],
      participants: [],
      remoteCursors: [],
      privateNotes: [],
      subtitleText: null,
    });
  }
}));

