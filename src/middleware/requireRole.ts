import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { UserRole } from '../models/User';

export function requireRole(...roles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!roles.length) {
      next();
      return;
    }

    const role = req.user?.role as UserRole | undefined;
    if (!role || !roles.includes(role)) {
      res.status(403).json({ error: 'No tienes permisos para acceder a esta sección' });
      return;
    }

    next();
  };
}
