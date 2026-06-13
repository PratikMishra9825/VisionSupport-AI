import express from 'express';
import { requireAgent } from '../middleware/auth';
import { AITranscript } from '../models/AITranscript';
import { Message } from '../models/Message';
import { Ticket } from '../models/Ticket';
import { KnowledgeBase } from '../models/KnowledgeBase';
import { decryptText } from '../services/security';
import { searchDocuments } from '../services/search';

const router = express.Router();

// Direct HTTP caller for Gemini API
const callGeminiCopilot = async (prompt: string): Promise<string> => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Gemini error: ${errorText}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Invalid response structure');
  return text.trim();
};

router.get('/:sessionId/copilot', requireAgent, async (req, res) => {
  try {
    const { sessionId } = req.params;

    // 1. Gather transcript and chat logs
    const transcript = await AITranscript.findOne({ sessionId });
    const chatMessages = await Message.find({ sessionId }).sort({ timestamp: 1 });

    const transcriptLines = (transcript?.segments || []).map(s => `${s.speakerName}: ${s.text}`);
    const chatLines = chatMessages.map(m => `${m.senderName}: ${decryptText(m.encryptedText)}`);
    const fullLog = [...transcriptLines, ...chatLines].join('\n');

    let aiSuggestions: any = null;

    if (fullLog.trim()) {
      try {
        const prompt = `Analyze the following support transcript and chat logs:
${fullLog.substring(0, 3000)}

Respond with ONLY a valid JSON object (no markdown wrapping, no explanation) containing:
1. "suggestedReplies": Array of 3 string chat replies the agent could send.
2. "troubleshootingSteps": Array of 3 string immediate troubleshooting instructions.
3. "sentiment": String ('positive', 'neutral', 'negative')
4. "sentimentScore": Number between -1.0 and 1.0.
5. "keywords": Array of 5 string keywords describing the technical problem or tools.
6. "actionItems": Array of string todo tasks.
`;
        const result = await callGeminiCopilot(prompt);
        const jsonStr = result.replace(/```json/g, '').replace(/```/g, '').trim();
        aiSuggestions = JSON.parse(jsonStr);
      } catch (err) {
        console.warn('Gemini Copilot failed, falling back to local NLP');
      }
    }

    // Local Fallback if Gemini failed or logs were empty
    if (!aiSuggestions) {
      const posWords = ['great', 'good', 'happy', 'solved', 'thanks', 'thank', 'perfect'];
      const negWords = ['error', 'broken', 'fail', 'angry', 'slow', 'frustrated', 'issue'];
      let score = 0;
      const words = fullLog.toLowerCase().split(/\s+/);
      for (const w of words) {
        if (posWords.some(p => w.includes(p))) score += 0.1;
        if (negWords.some(n => w.includes(n))) score -= 0.15;
      }
      score = Math.max(-1.0, Math.min(1.0, score));
      const sentiment = score > 0.15 ? 'positive' : score < -0.15 ? 'negative' : 'neutral';

      aiSuggestions = {
        suggestedReplies: [
          "Let's check if the browser permissions are allowed.",
          "Could you please run a network diagnostic from the HUD?",
          "I will review the connection logs to inspect the transport state."
        ],
        troubleshootingSteps: [
          "Verify webcam/microphone privacy settings in system preferences.",
          "Click the Autoplay override banner if remote streams are silent.",
          "Confirm UDP ports 10000-59999 are open for media transport."
        ],
        sentiment,
        sentimentScore: score,
        keywords: ['webrtc', 'mediasoup', 'camera', 'microphone', 'connection'],
        actionItems: ['Check customer browser settings', 'Inspect DTLS transport state']
      };
    }

    // 2. Query Similar solved tickets and relevant articles based on keywords
    const keywords = aiSuggestions.keywords || ['webrtc'];
    const searchString = keywords.join(' ');

    // Match in database
    const similarTickets = await Ticket.find({
      $or: [
        { issueTitle: { $regex: keywords[0] || '', $options: 'i' } },
        { problemDescription: { $regex: keywords[0] || '', $options: 'i' } }
      ]
    }).limit(2);

    const relevantArticles = await KnowledgeBase.find({
      $or: [
        { title: { $regex: keywords[0] || '', $options: 'i' } },
        { problemDescription: { $regex: keywords[0] || '', $options: 'i' } }
      ]
    }).limit(2);

    res.json({
      ...aiSuggestions,
      similarTickets: similarTickets.map(t => ({
        ticketId: t.ticketId,
        title: t.issueTitle,
        status: t.status,
        solution: t.solution
      })),
      relevantArticles: relevantArticles.map(a => ({
        articleId: a.articleId,
        title: a.title,
        solution: a.solution
      }))
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to generate copilot suggestions' });
  }
});

export default router;
