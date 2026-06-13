import express from 'express';
import { KnowledgeBase } from '../models/KnowledgeBase';
import { Ticket } from '../models/Ticket';
import { requireAgent } from '../middleware/auth';
import { AuditLog } from '../models/AuditLog';
import { indexDocument } from '../services/search';

const router = express.Router();

// Get and search all articles
router.get('/', requireAgent, async (req, res) => {
  try {
    const { q, category } = req.query;
    const filter: any = {};

    if (category) filter.category = category;

    if (q) {
      // Use text index search in MongoDB
      filter.$text = { $search: q as string };
    }

    const articles = await KnowledgeBase.find(filter).sort({ createdAt: -1 });
    res.json(articles);
  } catch (error) {
    // If text search index fails or isn't built yet, fallback to regex search
    try {
      const { q, category } = req.query;
      const filter: any = {};
      if (category) filter.category = category;
      if (q) {
        const regex = new RegExp(q as string, 'i');
        filter.$or = [
          { title: regex },
          { problemDescription: regex },
          { solution: regex }
        ];
      }
      const articles = await KnowledgeBase.find(filter).sort({ createdAt: -1 });
      return res.json(articles);
    } catch (err) {
      res.status(500).json({ error: 'Failed to search Knowledge Base articles' });
    }
  }
});

// Convert Solved Ticket to KB Article
router.post('/convert-ticket', requireAgent, async (req, res) => {
  try {
    const { ticketId, category, tags } = req.body;
    if (!ticketId) {
      return res.status(400).json({ error: 'Ticket ID is required' });
    }

    const ticket = await Ticket.findOne({ ticketId });
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    if (ticket.status !== 'Resolved' && ticket.status !== 'Closed') {
      return res.status(400).json({ error: 'Only Resolved or Closed tickets can be converted to articles' });
    }

    const existing = await KnowledgeBase.findOne({ ticketId });
    if (existing) {
      return res.status(400).json({ error: 'An article has already been generated from this ticket' });
    }

    const articleId = `KB-${Math.floor(1000 + Math.random() * 9000)}`;
    const newArticle = new KnowledgeBase({
      articleId,
      title: `Solution: ${ticket.issueTitle}`,
      problemDescription: ticket.problemDescription || 'N/A',
      solution: ticket.solution || 'N/A',
      category: category || ticket.category || 'General Support',
      tags: tags || [ticket.category],
      ticketId: ticket.ticketId
    });

    await newArticle.save();

    // Index in Elasticsearch
    await indexDocument('knowledgebases', newArticle.articleId, {
      articleId: newArticle.articleId,
      title: newArticle.title,
      problemDescription: newArticle.problemDescription,
      solution: newArticle.solution,
      category: newArticle.category,
      tags: newArticle.tags,
      ticketId: newArticle.ticketId,
      createdAt: newArticle.createdAt
    });

    await AuditLog.create({
      userId: (req as any).user.id,
      userName: (req as any).user.name,
      userRole: (req as any).user.role,
      action: 'kb_article_created',
      status: 'success',
      details: { articleId, ticketId }
    });

    res.status(201).json(newArticle);
  } catch (error) {
    res.status(500).json({ error: 'Failed to convert ticket to Knowledge Base article' });
  }
});

// Recommend similar solutions
router.get('/recommendations', requireAgent, async (req, res) => {
  try {
    const { q, category } = req.query;
    if (!q) {
      return res.status(400).json({ error: 'Query term q is required for recommendations' });
    }

    // Attempt to search similar solutions based on terms
    const words = (q as string).split(/\s+/).filter(w => w.length > 2);
    const filter: any = {};
    
    if (words.length > 0) {
      const regexes = words.map(w => new RegExp(w, 'i'));
      filter.$or = [
        { title: { $in: regexes } },
        { problemDescription: { $in: regexes } }
      ];
    } else {
      filter.title = new RegExp(q as string, 'i');
    }

    if (category) {
      filter.category = category;
    }

    const recommendations = await KnowledgeBase.find(filter).limit(5);
    res.json(recommendations);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch case recommendations' });
  }
});

export default router;
