import type { Request, Response, NextFunction } from 'express';

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  // Always log the full error server-side for debugging.
  console.error(err);

  // Only trust err.message for errors that were deliberately thrown by our
  // own code with an explicit client-facing status (e.g. a validation or
  // not-found error). Anything else - a Prisma error, a TypeError, an
  // unexpected exception - gets a generic message, since its .message can
  // contain internal details (query fragments, file paths, library
  // internals) that should never reach a client.
  const status = typeof err.status === 'number' ? err.status : 500;
  const message = status < 500 && typeof err.message === 'string' ? err.message : 'Internal server error';

  res.status(status).json({ error: { message } });
}

// Wrap async route handlers so thrown errors reach errorHandler
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}
