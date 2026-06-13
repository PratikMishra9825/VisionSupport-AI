import express from 'express';
import { Ticket } from '../models/Ticket';
import { requireAgent } from '../middleware/auth';
import { AuditLog } from '../models/AuditLog';
import { indexDocument } from '../services/search';
import { KnowledgeBase } from '../models/KnowledgeBase';

const router = express.Router();

// Search, filter, and fetch tickets
router.get('/', requireAgent, async (req, res) => {
  try {
    const { q, status, priority, category } = req.query;
    const filter: any = {};

    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (category) filter.category = category;

    if (q) {
      const searchRegex = new RegExp(q as string, 'i');
      filter.$or = [
        { ticketId: searchRegex },
        { issueTitle: searchRegex },
        { problemDescription: searchRegex },
        { customerName: searchRegex },
        { agentName: searchRegex }
      ];
    }

    const tickets = await Ticket.find(filter).sort({ createdTime: -1 });
    res.json(tickets);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tickets' });
  }
});

// Create ticket manually or automatically
router.post('/create', requireAgent, async (req, res) => {
  try {
    const { sessionId, customerName, agentName, issueTitle, problemDescription, rootCause, solution, priority, status, category, sessionDuration, recordingLink, sharedFiles, transcriptReference } = req.body;

    if (!sessionId || !issueTitle) {
      return res.status(400).json({ error: 'Session ID and Issue Title are required' });
    }

    const ticketId = `VS-${Math.floor(1000 + Math.random() * 9000)}`;
    const newTicket = new Ticket({
      ticketId,
      sessionId,
      customerName,
      agentName,
      issueTitle,
      problemDescription,
      rootCause,
      solution,
      priority,
      status: status || 'Open',
      category: category || 'General Support',
      sessionDuration,
      recordingLink,
      sharedFiles,
      transcriptReference
    });

    await newTicket.save();

    // Index in Elasticsearch
    await indexDocument('tickets', newTicket.ticketId, {
      ticketId: newTicket.ticketId,
      sessionId: newTicket.sessionId,
      customerName: newTicket.customerName,
      agentName: newTicket.agentName,
      issueTitle: newTicket.issueTitle,
      problemDescription: newTicket.problemDescription,
      rootCause: newTicket.rootCause,
      solution: newTicket.solution,
      priority: newTicket.priority,
      status: newTicket.status,
      category: newTicket.category,
      createdTime: newTicket.createdTime
    });

    await AuditLog.create({
      userId: (req as any).user.id,
      userName: (req as any).user.name,
      userRole: (req as any).user.role,
      action: 'ticket_created',
      status: 'success',
      details: { ticketId, sessionId }
    });

    res.status(201).json(newTicket);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create ticket' });
  }
});

// Update ticket status or details
router.put('/:ticketId', requireAgent, async (req, res) => {
  try {
    const { ticketId } = req.params;
    const updates = req.body;

    // Set closedTime if status is Closed
    if (updates.status === 'Closed' || updates.status === 'Resolved') {
      updates.closedTime = new Date();
    }

    const ticket = await Ticket.findOneAndUpdate({ ticketId }, updates, { new: true });
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Index update in Elasticsearch
    await indexDocument('tickets', ticket.ticketId, {
      ticketId: ticket.ticketId,
      sessionId: ticket.sessionId,
      customerName: ticket.customerName,
      agentName: ticket.agentName,
      issueTitle: ticket.issueTitle,
      problemDescription: ticket.problemDescription,
      rootCause: ticket.rootCause,
      solution: ticket.solution,
      priority: ticket.priority,
      status: ticket.status,
      category: ticket.category,
      createdTime: ticket.createdTime
    });

    await AuditLog.create({
      userId: (req as any).user.id,
      userName: (req as any).user.name,
      userRole: (req as any).user.role,
      action: 'ticket_updated',
      status: 'success',
      details: { ticketId, status: ticket.status }
    });

    res.json(ticket);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update ticket' });
  }
});

// Export Ticket as CSV
router.get('/:ticketId/export/csv', requireAgent, async (req, res) => {
  try {
    const { ticketId } = req.params;
    const ticket = await Ticket.findOne({ ticketId });
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const headers = 'Ticket ID,Session ID,Customer,Agent,Title,Description,Root Cause,Solution,Priority,Status,Created Time,Duration (s)\n';
    const row = `"${ticket.ticketId}","${ticket.sessionId}","${ticket.customerName}","${ticket.agentName}","${ticket.issueTitle}","${ticket.problemDescription || ''}","${ticket.rootCause || ''}","${ticket.solution || ''}","${ticket.priority}","${ticket.status}","${ticket.createdTime.toISOString()}","${ticket.sessionDuration}"\n`;
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=ticket_${ticketId}.csv`);
    res.send(headers + row);
  } catch (error) {
    res.status(500).json({ error: 'Failed to export ticket CSV' });
  }
});

// Export Ticket as PDF (Formatted plaintext or simple mock PDF download)
router.get('/:ticketId/export/pdf', requireAgent, async (req, res) => {
  try {
    const { ticketId } = req.params;
    const ticket = await Ticket.findOne({ ticketId });
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const pdfText = `
====================================================
           VISIONSUPPORT AI SUPPORT TICKET
====================================================
Ticket ID:          ${ticket.ticketId}
Session ID:         ${ticket.sessionId}
Status:             ${ticket.status}
Priority:           ${ticket.priority}
Category:           ${ticket.category}
Created Time:       ${ticket.createdTime.toLocaleString()}
Closed Time:        ${ticket.closedTime ? ticket.closedTime.toLocaleString() : 'N/A'}
Session Duration:   ${ticket.sessionDuration} seconds

----------------------------------------------------
PARTICIPANTS
----------------------------------------------------
Customer Name:      ${ticket.customerName}
Agent Name:         ${ticket.agentName}

----------------------------------------------------
ISSUE DETAILS
----------------------------------------------------
Title:              ${ticket.issueTitle}
Description:
${ticket.problemDescription || 'N/A'}

Root Cause:
${ticket.rootCause || 'N/A'}

Solution Provided:
${ticket.solution || 'N/A'}

----------------------------------------------------
ATTACHMENTS & RECORDINGS
----------------------------------------------------
Recording Link:     ${ticket.recordingLink || 'N/A'}
Shared Files:       ${(ticket.sharedFiles || []).join(', ') || 'None'}
====================================================
`;
    
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename=ticket_${ticketId}.txt`);
    res.send(pdfText);
  } catch (error) {
    res.status(500).json({ error: 'Failed to export ticket PDF' });
  }
});

// AI Ticket Intelligence Predictor
router.get('/:ticketId/intelligence', requireAgent, async (req, res) => {
  try {
    const { ticketId } = req.params;
    const ticket = await Ticket.findOne({ ticketId });
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    let prediction: any = null;

    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      try {
        const prompt = `Analyze the following support ticket:
Title: ${ticket.issueTitle}
Description: ${ticket.problemDescription}
Root Cause: ${ticket.rootCause}
Solution: ${ticket.solution}

Respond with ONLY a valid JSON object (no markdown, no explanations) containing:
1. "predictedSeverity": String ('Low' | 'Medium' | 'High' | 'Critical')
2. "predictedCategory": String (e.g. 'Network', 'Video', 'Hardware', 'Software')
3. "predictedPriority": String ('Low' | 'Medium' | 'High')
4. "escalationRisk": String ('Low' | 'Medium' | 'High')
5. "resolutionProbability": Number (0 to 100 percentage representing likelihood of ticket being successfully resolved by agent)
6. "troubleshootingTips": Array of 3 next suggested steps.
`;
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        if (response.ok) {
          const data = await response.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
            prediction = JSON.parse(jsonStr);
          }
        }
      } catch (err) {
        console.warn('Gemini Ticket Intelligence failed, using fallback prediction');
      }
    }

    if (!prediction) {
      // Fallback predictions
      const containsWebRTC = (ticket.issueTitle + ' ' + (ticket.problemDescription || '')).toLowerCase().includes('webrtc') ||
                             (ticket.issueTitle + ' ' + (ticket.problemDescription || '')).toLowerCase().includes('camera');
      prediction = {
        predictedSeverity: containsWebRTC ? 'High' : 'Medium',
        predictedCategory: containsWebRTC ? 'Video' : 'General Support',
        predictedPriority: ticket.priority || 'Medium',
        escalationRisk: containsWebRTC ? 'Medium' : 'Low',
        resolutionProbability: 90,
        troubleshootingTips: [
          'Verify that media ports and UDP flows are clear on the network.',
          'Review the guest autoplay configurations on their local browser profile.',
          'Check system event log bookmarks to inspect client join timestamps.'
        ]
      };
    }

    // Find similar solved tickets and suggested KB articles
    const similarTickets = await Ticket.find({
      ticketId: { $ne: ticketId },
      category: ticket.category || 'General Support',
      status: { $in: ['Resolved', 'Closed'] }
    }).limit(2);

    const suggestedArticles = await KnowledgeBase.find({
      category: ticket.category || 'General Support'
    }).limit(2);

    res.json({
      ...prediction,
      similarSolvedTickets: similarTickets.map(t => ({
        ticketId: t.ticketId,
        title: t.issueTitle,
        solution: t.solution
      })),
      suggestedArticles: suggestedArticles.map(a => ({
        articleId: a.articleId,
        title: a.title,
        solution: a.solution
      }))
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to generate ticket intelligence' });
  }
});

export default router;
