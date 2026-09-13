import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../lib/auth.js';

// Like requireAuth, but never rejects the request - it just populates
// req.user when a valid token is present, so a route can render
// differently for a logged-in caller without requiring login to view it.
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    const token = header.slice('Bearer '.length);
    try {
      req.user = verifyToken(token);
    } catch {
      // Invalid/expired token on an optional-auth route - proceed as anonymous.
    }
  }
  next();
}
