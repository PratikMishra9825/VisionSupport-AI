import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';

export const requireAgent = async (req: Request, res: Response, next: NextFunction) => {
  // 1. CSRF Protection for state changes (POST, PUT, DELETE)
  if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
    const csrfToken = req.headers['x-csrf-token'] as string;
    if (!csrfToken) {
      return res.status(403).json({ error: 'CSRF token verification failed: Token missing.' });
    }
    try {
      const decodedCsrf = jwt.verify(csrfToken, process.env.JWT_SECRET || 'visionsupport_jwt_secret_default') as any;
      if (!decodedCsrf || decodedCsrf.type !== 'csrf') {
        return res.status(403).json({ error: 'CSRF token verification failed: Token invalid.' });
      }
    } catch (err) {
      return res.status(403).json({ error: 'CSRF token verification failed: Token expired.' });
    }
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'visionsupport_jwt_secret_default') as any;
    if (payload.role !== 'agent' && payload.role !== 'supervisor') {
      return res.status(403).json({ error: 'Forbidden: Operator authorization required' });
    }

    // Retrieve user profile state from database
    const user = await User.findById(payload.id);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized: Operator profile not found.' });
    }

    if (user.disabled) {
      return res.status(403).json({ error: 'Forbidden: Account has been disabled.' });
    }

    // Validate active session
    if (payload.deviceSessionId) {
      const active = (user.deviceSessions || []).some(s => s.sessionId === payload.deviceSessionId);
      if (!active) {
        return res.status(401).json({ error: 'Unauthorized: Device session revoked or logged out.' });
      }
    }

    (req as any).user = payload;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};
