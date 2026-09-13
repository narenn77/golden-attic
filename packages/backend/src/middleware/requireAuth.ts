import type { Request, Response, NextFunction } from 'express';
import { verifyToken, type AuthTokenPayload } from '../lib/auth.js';

// Extend Express's Request type so req.user is typed everywhere it's used.
declare global {
  namespace Express {
    interface Request {
      user?: AuthTokenPayload;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: { message: 'Missing or invalid Authorization header' } });
  }

  const token = header.slice('Bearer '.length);

  try {
    req.user = verifyToken(token);
    next();
  } catch {
    res.status(401).json({ error: { message: 'Invalid or expired token' } });
  }
}
