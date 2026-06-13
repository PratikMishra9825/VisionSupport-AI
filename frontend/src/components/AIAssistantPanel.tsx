"use client";
import { API_BASE, SOCKET_BASE } from '@/config';

import { useState, useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { Sparkles, Copy, HelpCircle, Check, AlertCircle, FileText, ChevronRight } from 'lucide-react';

interface TranscriptSegment {
  speaker: string;
  text: string;
  time: string;
}

interface AIAssistantPanelProps {
  sessionId: string;
  transcripts: TranscriptSegment[];
}

export default function AIAssistantPanel({ sessionId, transcripts }: AIAssistantPanelProps) {
  const { token } = useStore();
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  // Copilot States
  const [suggestedReplies, setSuggestedReplies] = useState<string[]>([
    "Hello, thank you for joining. How can I help you today?",
    "Could you please share your camera or screen so I can inspect the hardware?",
    "I have opened the collaborative whiteboard. Please point out the issue there."
  ]);
  const [troubleshootingSteps, setTroubleshootingSteps] = useState<string[]>([
    "Verify webcam/microphone privacy settings in system preferences.",
    "Click the Autoplay override banner if remote audio is silent.",
    "Confirm UDP ports 10000-59999 are open for media transport."
  ]);
  const [sentiment, setSentiment] = useState<'positive' | 'neutral' | 'negative'>('neutral');
  const [sentimentScore, setSentimentScore] = useState<number>(0.0);
  const [keywords, setKeywords] = useState<string[]>(['webrtc', 'camera', 'connection']);
  const [actionItems, setActionItems] = useState<string[]>([]);
  const [similarTickets, setSimilarTickets] = useState<any[]>([]);
  const [relevantArticles, setRelevantArticles] = useState<any[]>([]);

  // Periodically fetch Copilot intelligence
  useEffect(() => {
    const fetchCopilotData = async () => {
      if (!token) return;
      try {
        const res = await fetch(`${API_BASE}/copilot/${sessionId}/copilot`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.suggestedReplies) setSuggestedReplies(data.suggestedReplies);
          if (data.troubleshootingSteps) setTroubleshootingSteps(data.troubleshootingSteps);
          if (data.sentiment) setSentiment(data.sentiment);
          if (typeof data.sentimentScore === 'number') setSentimentScore(data.sentimentScore);
          if (data.keywords) setKeywords(data.keywords);
          if (data.actionItems) setActionItems(data.actionItems);
          if (data.similarTickets) setSimilarTickets(data.similarTickets);
          if (data.relevantArticles) setRelevantArticles(data.relevantArticles);
        }
      } catch (err) {
        console.warn('Failed to load AI Copilot recommendations:', err);
      }
    };

    fetchCopilotData();
    const interval = setInterval(fetchCopilotData, 10000); // refresh every 10 seconds
    return () => clearInterval(interval);
  }, [sessionId, token]);

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    window.dispatchEvent(new CustomEvent('insert-chat-text', { detail: text }));
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const getSentimentColor = () => {
    if (sentiment === 'positive') return 'text-green-400 bg-green-950/20 border-green-500/30';
    if (sentiment === 'negative') return 'text-red-400 bg-red-950/20 border-red-500/30';
    return 'text-purple-400 bg-purple-950/20 border-purple-500/30';
  };

  return (
    <div className="flex flex-col h-full space-y-4 overflow-y-auto pr-1 custom-scrollbar pb-6 select-none">
      
      {/* 1. Live Transcript */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4 glass-panel flex flex-col max-h-48 overflow-hidden">
        <h3 className="text-xs font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 uppercase tracking-widest font-cyber mb-2.5 flex items-center gap-1.5 shrink-0">
          <Sparkles className="w-3.5 h-3.5 animate-pulse text-purple-400" /> Live Call Transcript
        </h3>
        
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar text-[10px]">
          {transcripts.length === 0 ? (
            <div className="h-full flex items-center justify-center text-gray-500 italic text-center py-6">
              Awaiting live speech/audio transcription...
            </div>
          ) : (
            transcripts.map((t, idx) => (
              <div key={idx} className="bg-black/20 p-2 rounded-xl border border-white/5 space-y-0.5">
                <div className="flex justify-between items-center text-[8px] text-gray-500 font-mono">
                  <span className="font-bold text-purple-400">{t.speaker}</span>
                  <span>{t.time}</span>
                </div>
                <p className="text-gray-300 font-medium italic">"{t.text}"</p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 2. Sentiment & Keywords Indicator */}
      <div className="grid grid-cols-2 gap-3 shrink-0">
        {/* Sentiment Analysis Card */}
        <div className={`p-4 border rounded-2xl flex flex-col justify-between ${getSentimentColor()} backdrop-blur-md`}>
          <div>
            <h4 className="text-[9px] uppercase tracking-wider font-mono text-gray-400 mb-1">Sentiment</h4>
            <p className="text-sm font-extrabold capitalize font-cyber">{sentiment}</p>
          </div>
          <div className="mt-2 text-[10px] font-mono text-gray-500 flex items-center justify-between">
            <span>Polarity Score:</span>
            <span className="font-bold text-white">{(sentimentScore).toFixed(2)}</span>
          </div>
        </div>

        {/* Keywords badges */}
        <div className="p-4 bg-white/5 border border-white/10 rounded-2xl flex flex-col justify-between backdrop-blur-md">
          <h4 className="text-[9px] uppercase tracking-wider font-mono text-gray-400 mb-1">Extracted Keywords</h4>
          <div className="flex flex-wrap gap-1 max-h-12 overflow-y-auto custom-scrollbar">
            {keywords.map((kw, i) => (
              <span key={i} className="text-[9px] px-2 py-0.5 bg-purple-500/10 border border-purple-500/20 text-purple-300 rounded-full font-mono">
                #{kw}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* 3. AI Smart Replies suggestions */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4 glass-panel space-y-2.5 shrink-0">
        <h3 className="text-xs font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 uppercase tracking-widest font-cyber flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-purple-400" /> AI Smart Replies
        </h3>
        <p className="text-[9px] text-gray-500 font-mono">Click to auto-fill into chat input.</p>
        <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
          {suggestedReplies.map((reply, idx) => (
            <button
              key={idx}
              onClick={() => handleCopy(reply, idx)}
              className="group text-left p-2 bg-black/30 border border-white/5 rounded-xl text-[10px] text-gray-300 hover:border-purple-500/40 hover:bg-purple-950/10 transition flex justify-between items-start gap-2"
            >
              <span className="group-hover:text-purple-300 transition duration-300 line-clamp-2 leading-relaxed">{reply}</span>
              <span className="text-gray-500 group-hover:text-purple-400 shrink-0 mt-0.5">
                {copiedIndex === idx ? <Check size={11} className="text-green-400" /> : <Copy size={11} />}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* 4. Action Items list */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4 glass-panel space-y-2 shrink-0">
        <h3 className="text-xs font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 uppercase tracking-widest font-cyber flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 text-purple-400" /> Detected Action Items
        </h3>
        <div className="space-y-2 text-[10px] font-mono text-gray-400 max-h-28 overflow-y-auto custom-scrollbar">
          {actionItems.length === 0 ? (
            <div className="text-gray-600 italic">No action items detected yet.</div>
          ) : (
            actionItems.map((item, i) => (
              <div key={i} className="flex gap-2 items-start bg-black/20 p-2 rounded-lg border border-white/5">
                <input type="checkbox" className="mt-0.5 cursor-pointer accent-purple-500 shrink-0" />
                <span className="text-gray-300">{item}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 5. Troubleshooting Steps */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4 glass-panel space-y-2 shrink-0">
        <h3 className="text-xs font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 uppercase tracking-widest font-cyber flex items-center gap-1.5">
          <HelpCircle className="w-3.5 h-3.5 text-purple-400" /> Suggested Troubleshooting Steps
        </h3>
        <div className="space-y-2 text-[10px] text-gray-400 font-mono">
          {troubleshootingSteps.map((step, idx) => (
            <div key={idx} className="flex gap-2 items-start bg-black/20 p-2 rounded-lg border border-white/5">
              <span className="text-purple-400 font-bold shrink-0">{idx + 1}.</span>
              <p className="text-gray-300">{step}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 6. KB Articles & Similar solved tickets */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4 glass-panel space-y-3 shrink-0">
        <h3 className="text-xs font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 uppercase tracking-widest font-cyber flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5 text-purple-400" /> KB & Similar Solved Cases
        </h3>

        {/* Articles */}
        <div className="space-y-1.5">
          <h4 className="text-[9px] uppercase tracking-wider font-mono text-purple-400">Knowledge-Base Articles</h4>
          {relevantArticles.length === 0 ? (
            <div className="text-gray-600 text-[10px] italic font-mono pl-1">No matches found.</div>
          ) : (
            relevantArticles.map((art) => (
              <div key={art.articleId} className="p-2 bg-black/20 rounded-lg border border-white/5 flex flex-col gap-1 text-[10px] font-mono">
                <span className="text-gray-200 font-bold flex items-center gap-1">
                  <ChevronRight size={10} className="text-purple-500" /> {art.title}
                </span>
                {art.solution && (
                  <p className="text-gray-400 text-[9px] pl-3 italic border-l border-purple-500/20 mt-0.5">Solution: {art.solution}</p>
                )}
              </div>
            ))
          )}
        </div>

        {/* Tickets */}
        <div className="space-y-1.5 pt-1 border-t border-white/5">
          <h4 className="text-[9px] uppercase tracking-wider font-mono text-blue-400">Similar Solved Tickets</h4>
          {similarTickets.length === 0 ? (
            <div className="text-gray-600 text-[10px] italic font-mono pl-1">No similar cases found.</div>
          ) : (
            similarTickets.map((tkt) => (
              <div key={tkt.ticketId} className="p-2 bg-black/20 rounded-lg border border-white/5 flex flex-col gap-1 text-[10px] font-mono">
                <span className="text-gray-200 font-bold flex items-center gap-1">
                  <ChevronRight size={10} className="text-blue-500" /> {tkt.ticketId}: {tkt.title}
                </span>
                {tkt.solution && (
                  <p className="text-gray-400 text-[9px] pl-3 italic border-l border-blue-500/20 mt-0.5">Solution: {tkt.solution}</p>
                )}
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
}
