import { Request, Response, NextFunction } from 'express';

type Role = 'ADMIN' | 'COACH';

/**
 * Middleware to require specific roles
 */
export function requireRole(...allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: 'Insufficient permissions',
        required: allowedRoles,
        current: req.user.role
      });
      return;
    }

    next();
  };
}

/**
 * Middleware to require admin role
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  if (req.user.role !== 'ADMIN') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }

  next();
}

/**
 * Check if user can access a specific client
 * Admins can access all clients, coaches can only access their own
 */
export async function canAccessClient(
  userId: string,
  userRole: Role,
  clientCoachId: string
): Promise<boolean> {
  if (userRole === 'ADMIN') {
    return true;
  }

  return userId === clientCoachId;
}

/**
 * Middleware to filter client access based on user role
 * For use with list endpoints - modifies query to filter by coach
 *
 * By default, ALL users (coaches and admins) see ALL clients.
 * Coaches can optionally filter to see only their clients via ?myClientsOnly=true
 */
export function filterByCoach(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  // Check if user wants to filter to only their clients
  const myClientsOnly = req.query.myClientsOnly === 'true';

  if (myClientsOnly && req.user.role === 'COACH') {
    // Coach requested to see only their clients
    (req as any).coachFilter = { coachId: req.user.id };
  } else {
    // Default: everyone sees all clients
    (req as any).coachFilter = {};
  }

  next();
}
