import express from 'express';
import { requireAgent } from '../middleware/auth';
import { searchDocuments } from '../services/search';

const router = express.Router();

// Global Search endpoint
router.get('/', requireAgent, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'Search query parameter "q" is required' });
    }

    const queryText = q.trim();
    console.log(`Global Search triggering query for text: "${queryText}"`);

    // Run searches in parallel
    const [tickets, articles, messages, recordings, files, sessions] = await Promise.all([
      searchDocuments('tickets', queryText),
      searchDocuments('knowledgebases', queryText),
      searchDocuments('messages', queryText),
      searchDocuments('recordings', queryText),
      searchDocuments('files', queryText),
      searchDocuments('sessions', queryText)
    ]);

    res.json({
      query: queryText,
      results: {
        tickets: tickets.map(t => ({ id: t.ticketId || t.id, title: t.issueTitle || t.title, status: t.status, agent: t.agentName })),
        articles: articles.map(a => ({ id: a.articleId || a.id, title: a.title, category: a.category })),
        messages: messages.map(m => ({ id: m.id, text: m.text, sender: m.senderName, timestamp: m.timestamp, sessionId: m.sessionId })),
        recordings: recordings.map(r => ({ id: r.recordingId || r.id, status: r.status, videoUrl: r.videoUrl, duration: r.duration })),
        files: files.map(f => ({ id: f.fileId || f.id, filename: f.filename, size: f.sizeBytes, url: f.url })),
        sessions: sessions.map(s => ({ id: s.sessionId || s.id, status: s.status, createdAt: s.createdAt }))
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Global search failed' });
  }
});

export default router;
