import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    role: string;
    name?: string;
    email?: string;
  };
}

export function authenticateJWT(req: Request, res: Response, next: NextFunction): void {
  const authReq = req as AuthRequest;
  const authHeader = authReq.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ message: 'No token provided' });
    return;
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!);
    authReq.user = decoded as { id: string; role: string };
    next();
  } catch {
    res.status(401).json({ message: 'Invalid token' });
  }
}

// Adjust `authorizeRoles` middleware to ensure compatibility with `RequestHandler`
export function authorizeRoles(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;
    if (!authReq.user || !roles.includes(authReq.user.role)) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }
    next();
  };
}
