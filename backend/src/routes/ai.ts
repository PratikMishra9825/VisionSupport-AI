import express from 'express';
import { AITranscript } from '../models/AITranscript';
import { requireAgent } from '../middleware/auth';
import {
  generateMeetingSummary,
  analyzeSentiment,
  extractActionItems,
  generateSupportTicket,
  translateText
} from '../services/gemini';

const router = express.Router();

// Get AI Transcript for Session
router.get('/session/:sessionId/transcript', async (req, res) => {
  try {
    const { sessionId } = req.params;
    let transcript = await AITranscript.findOne({ sessionId });
    
    if (!transcript) {
      transcript = new AITranscript({
        sessionId,
        segments: [],
        summary: '',
        actionItems: [],
        ticketGenerated: {}
      });
      await transcript.save();
    }
    
    res.json(transcript);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch session transcript' });
  }
});

// Analyze session transcript (runs summary, sentiment, action items, ticket)
router.post('/session/:sessionId/analyze', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const transcript = await AITranscript.findOne({ sessionId });
    
    if (!transcript || transcript.segments.length === 0) {
      return res.status(400).json({ error: 'No transcript segments available for analysis' });
    }

    // Assemble text transcript
    const fullText = transcript.segments
      .map(s => `${s.speakerName} (${s.speakerRole}): ${s.text}`)
      .join('\n');

    console.log(`Analyzing AI transcript for session ${sessionId} (${transcript.segments.length} segments)...`);

    // Run parallel analysis calls
    const [summary, sentimentData, actionItems, ticket] = await Promise.all([
      generateMeetingSummary(fullText),
      analyzeSentiment(fullText),
      extractActionItems(fullText),
      generateSupportTicket(fullText)
    ]);

    transcript.summary = summary;
    transcript.sentiment = sentimentData.sentiment;
    transcript.sentimentScore = sentimentData.score;
    transcript.actionItems = actionItems;
    transcript.ticketGenerated = { ...ticket, status: 'Open' };
    transcript.updatedAt = new Date();
    
    await transcript.save();

    res.json(transcript);
  } catch (error) {
    console.error('Session transcript AI analysis failed:', error);
    res.status(500).json({ error: 'Failed to perform AI analysis on transcript' });
  }
});

// Translate individual text
router.post('/translate', async (req, res) => {
  try {
    const { text, targetLanguage } = req.body;
    if (!text || !targetLanguage) {
      return res.status(400).json({ error: 'Text and targetLanguage are required' });
    }

    const translated = await translateText(text, targetLanguage);
    res.json({ original: text, translated, targetLanguage });
  } catch (error) {
    res.status(500).json({ error: 'Failed to translate text' });
  }
});

export default router;
