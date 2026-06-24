import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export type Role = 'admin' | 'driver' | 'employee';

export interface AuthPayload {
  sub: string; // document id (User / Driver / Employee)
  role: Role;
}

// Augment Express Request so handlers can read req.auth in a typed way.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthPayload;
    }
  }
}

function readToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  return null;
}

export function verifyToken(token: string): AuthPayload {
  const decoded = jwt.verify(token, env.jwtSecret) as jwt.JwtPayload;
  return { sub: String(decoded.sub), role: (decoded.role as Role) ?? 'admin' };
}

export function signToken(
  payload: AuthPayload,
  expiresIn: jwt.SignOptions['expiresIn'] = '12h'
): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn });
}

// Verifies the JWT and attaches the decoded payload to req.auth.
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = readToken(req);
  if (!token) {
    res.status(401).json({ error: 'Missing Authorization header' });
    return;
  }
  try {
    req.auth = verifyToken(token);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Verifies the JWT AND enforces that the caller has one of the allowed roles.
export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const token = readToken(req);
    if (!token) {
      res.status(401).json({ error: 'Missing Authorization header' });
      return;
    }
    try {
      const payload = verifyToken(token);
      if (!roles.includes(payload.role)) {
        res.status(403).json({ error: 'Forbidden: insufficient role' });
        return;
      }
      req.auth = payload;
      next();
    } catch {
      res.status(401).json({ error: 'Invalid or expired token' });
    }
  };
}
