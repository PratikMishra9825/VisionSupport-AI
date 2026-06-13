import express from 'express';
import { Notification } from '../models/Notification';
import { requireAgent } from '../middleware/auth';

const router = express.Router();

// Get agent notifications
router.get('/', requireAgent, async (req, res) => {
  try {
    const agentId = (req as any).user.id;
    const list = await Notification.find({ agentId }).sort({ createdAt: -1 }).limit(50);
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Mark notification as read
router.put('/:id/read', requireAgent, async (req, res) => {
  try {
    const { id } = req.params;
    const agentId = (req as any).user.id;
    const notification = await Notification.findOneAndUpdate(
      { _id: id, agentId },
      { read: true },
      { new: true }
    );
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    res.json(notification);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update notification' });
  }
});

export default router;
