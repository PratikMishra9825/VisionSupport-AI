"use client";
import { API_BASE, SOCKET_BASE } from '@/config';

import React, { useState, useEffect, useRef, memo } from 'react';
import { useStore, MessagePayload } from '@/store/useStore';
import { Socket } from 'socket.io-client';
import { Send, Search, Globe, Bot, Shield, User, ThumbsUp, Heart, Smile, Loader } from 'lucide-react';

interface ChatProps {
  socket: Socket | null;
  sessionId: string;
}

const Chat = memo(function Chat({ socket, sessionId }: ChatProps) {
  const { messages, addMessage, role, name: userName, privateNotes } = useStore();
  const [whisperText, setWhisperText] = useState('');
  const [text, setText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [targetLang, setTargetLang] = useState('default');
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Track typing throttle
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const handleInsertText = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        setText(customEvent.detail);
      }
    };
    window.addEventListener('insert-chat-text', handleInsertText);
    return () => window.removeEventListener('insert-chat-text', handleInsertText);
  }, []);

  // Hook socket channels
  useEffect(() => {
    if (!socket) return;

    socket.on('chat-message', (msg: MessagePayload) => {
      addMessage(msg);
    });

    socket.on('chat-typing-status', ({ name, isTyping }) => {
      if (isTyping) {
        setTypingUser(name);
      } else {
        setTypingUser(null);
      }
    });

    return () => {
      socket.off('chat-message');
      socket.off('chat-typing-status');
    };
  }, [socket]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !socket) return;

    // Emit chat message
    socket.emit('send-chat-message', {
      text: text.trim(),
      targetLang,
    }, (res: any) => {
      if (res.error) console.error(res.error);
    });

    // Check if message triggers AI Bot
    if (text.trim().startsWith('@ai ')) {
      triggerAIAssistant(text.trim().substring(4));
    }

    setText('');
    handleTyping(false);
  };

  const triggerAIAssistant = async (prompt: string) => {
    try {
      // Simulate Bot is typing
      setTypingUser('VisionSupport Bot');
      
      const history = messages.slice(-10).map(m => ({ role: m.senderRole, text: m.text }));
      const res = await fetch(`${API_BASE}/ai/translate`, { // Reuse AI routing config
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: prompt, targetLanguage: 'English' }), // We can send direct bot queries here
      });
      
      // Let's call the actual AI chatbot endpoint if implemented, or mock answer
      setTimeout(() => {
        setTypingUser(null);
        // Emulate bot message returning
        const botMsg: MessagePayload = {
          _id: Date.now().toString(),
          senderId: 'ai-bot',
          senderName: 'VisionSupport Bot',
          senderRole: 'observer',
          text: `I received your prompt: "${prompt}". (AI Active: processing resolution tasks...)`,
          timestamp: new Date().toISOString(),
        };
        addMessage(botMsg);
      }, 1500);
    } catch (err) {
      setTypingUser(null);
    }
  };

  const handleTyping = (isTyping: boolean) => {
    if (!socket) return;

    socket.emit('chat-typing', { isTyping });

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    if (isTyping) {
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('chat-typing', { isTyping: false });
      }, 3000);
    }
  };

  const addReaction = (messageId: string, emoji: string) => {
    socket?.emit('chat-message-reaction', { messageId, emoji });
  };

  const handleSendWhisper = (e: React.FormEvent) => {
    e.preventDefault();
    if (!whisperText.trim() || !socket) return;

    socket.emit('send-private-note', {
      note: whisperText.trim(),
    });

    setWhisperText('');
  };

  // Filter messages based on search query
  const filteredMessages = messages.filter((m) =>
    m.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.senderName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Normalize private notes for inline supervisor/agent feed (strictly hidden from customers)
  const isAgentOrSupervisor = role === 'agent' || role === 'supervisor';
  const displayWhispers = isAgentOrSupervisor
    ? privateNotes
        .filter((n) =>
          n.note.toLowerCase().includes(searchQuery.toLowerCase()) ||
          n.senderName.toLowerCase().includes(searchQuery.toLowerCase())
        )
        .map((n, idx) => ({
          _id: `whisper-${idx}-${new Date(n.timestamp).getTime()}`,
          senderId: 'whisper-sender',
          senderName: n.senderName,
          senderRole: 'supervisor' as const,
          text: n.note,
          timestamp: n.timestamp,
          isWhisper: true,
          reactions: []
        }))
    : [];

  const allFeedItems = [...filteredMessages, ...displayWhispers].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  return (
    <div className="flex flex-col h-full bg-black/40 border border-white/10 rounded-2xl overflow-hidden glass-panel">
      {/* Top search and filter bar */}
      <div className="p-3 bg-black/60 border-b border-white/10 flex items-center justify-between space-x-3 select-none">
        <div className="flex-1 relative">
          <Search size={14} className="absolute left-3 top-2.5 text-gray-500" />
          <input
            type="text"
            placeholder="Search chat history..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 bg-black/30 border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-purple-500"
          />
        </div>
        
        {/* Subtitle language translator select */}
        <div className="relative" title="Translate incoming text">
          <Globe size={14} className="absolute left-2.5 top-2.5 text-purple-400" />
          <select
            value={targetLang}
            onChange={(e) => setTargetLang(e.target.value)}
            className="pl-8 pr-2 py-1.5 bg-black/30 border border-white/10 rounded-lg text-xs text-purple-400 focus:outline-none cursor-pointer font-semibold"
          >
            <option value="default">Original</option>
            <option value="Spanish">Spanish</option>
            <option value="French">French</option>
            <option value="German">German</option>
            <option value="Chinese">Chinese</option>
          </select>
        </div>
      </div>

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {allFeedItems.map((msg) => {
          const isMe = msg.senderName === userName;
          const isAI = msg.senderId === 'ai-bot';
          const isAgent = msg.senderRole === 'agent' || msg.senderRole === 'supervisor';
          const isWhisper = (msg as any).isWhisper;

          return (
            <div key={msg._id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
              <div className="flex items-center space-x-2 mb-1">
                {isWhisper ? (
                  <Shield size={12} className="text-amber-400 animate-pulse" />
                ) : isAI ? (
                  <Bot size={12} className="text-blue-400" />
                ) : isAgent ? (
                  <Shield size={12} className="text-purple-400" />
                ) : (
                  <User size={12} className="text-gray-400" />
                )}
                <span className="text-[10px] text-gray-400 font-semibold">
                  {msg.senderName} {isWhisper && <span className="text-amber-400 text-[8px] uppercase tracking-widest ml-1 bg-amber-500/10 border border-amber-500/20 px-1 py-0.5 rounded-md font-mono font-extrabold animate-pulse">Whisper</span>}
                </span>
                <span className="text-[9px] text-gray-500">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>

              {/* Message bubble */}
              <div className="relative group max-w-[80%]">
                <div className={`p-3 rounded-2xl text-sm leading-relaxed ${
                  isWhisper
                    ? 'bg-amber-950/45 border border-amber-500/40 rounded-tl-none text-amber-200 shadow-[0_0_12px_rgba(245,158,11,0.15)] font-cyber'
                    : isMe
                      ? 'bg-gradient-to-r from-blue-600/30 to-purple-600/30 border border-purple-500/20 rounded-tr-none text-white'
                      : isAI
                        ? 'bg-blue-950/30 border border-blue-500/30 rounded-tl-none text-blue-200'
                        : 'bg-white/5 border border-white/10 rounded-tl-none text-gray-200'
                }`}>
                  <p>{msg.text}</p>

                  {/* Reaction Badges */}
                  {!isWhisper && msg.reactions && msg.reactions.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {msg.reactions.map((r: { userId: string; emoji: string }, i: number) => (
                        <span key={i} className="text-[10px] px-1.5 py-0.5 bg-black/40 rounded-full border border-white/10" title="Reaction">
                          {r.emoji}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Hover Reactions Row */}
                {!isWhisper && role !== 'observer' && (
                  <div className={`absolute top-0 -translate-y-8 flex items-center space-x-1.5 p-1 bg-gray-900 border border-white/15 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition duration-200 z-10 ${
                    isMe ? 'right-0' : 'left-0'
                  }`}>
                    <button onClick={() => addReaction(msg._id, '👍')} className="text-xs hover:scale-125 transition"><ThumbsUp size={11} className="text-yellow-500" /></button>
                    <button onClick={() => addReaction(msg._id, '❤️')} className="text-xs hover:scale-125 transition"><Heart size={11} className="text-red-500" /></button>
                    <button onClick={() => addReaction(msg._id, '😂')} className="text-xs hover:scale-125 transition"><Smile size={11} className="text-yellow-500" /></button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        
        {/* Typing Notification indicator */}
        {typingUser && (
          <div className="flex items-center space-x-2 text-xs text-purple-400/80 italic font-mono select-none animate-pulse">
            <Loader size={12} className="animate-spin" />
            <span>{typingUser} is typing...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input panel */}
      {role !== 'observer' ? (
        <div className="flex flex-col border-t border-white/10">
          {/* Public Chat Form */}
          <form onSubmit={handleSend} className="p-3 bg-black/60 flex items-center space-x-2">
            <input
              type="text"
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                handleTyping(e.target.value.length > 0);
              }}
              placeholder="Type public message... (e.g. '@ai how do I configure blur?')"
              className="flex-1 px-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-purple-500 text-white"
            />
            <button
              type="submit"
              className="p-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl transition shadow-lg shadow-purple-500/10 hover:shadow-purple-500/25"
            >
              <Send size={16} />
            </button>
          </form>

          {/* Supervisor & Agent Whisper Input (strictly hidden from customer) */}
          {(role === 'supervisor' || role === 'agent') && (
            <form onSubmit={handleSendWhisper} className="p-3 bg-amber-950/20 border-t border-amber-500/20 flex items-center space-x-2">
              <span className="text-[10px] text-amber-500 font-cyber font-bold uppercase tracking-widest shrink-0 animate-pulse">Whisper:</span>
              <input
                type="text"
                value={whisperText}
                onChange={(e) => setWhisperText(e.target.value)}
                placeholder="Send private whisper to agents/supervisors..."
                className="flex-1 px-4 py-2 bg-black/40 border border-amber-500/25 rounded-xl text-xs focus:outline-none focus:border-amber-500 text-amber-100 placeholder-amber-700"
              />
              <button
                type="submit"
                className="p-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl transition shadow-lg shadow-amber-500/10"
              >
                <Send size={12} />
              </button>
            </form>
          )}
        </div>
      ) : (
        <div className="p-3 bg-black/60 border-t border-white/10 text-center text-xs text-gray-500 italic select-none">
          Observer mode: chat entries are read-only.
        </div>
      )}
    </div>
  );
});

export default Chat;
