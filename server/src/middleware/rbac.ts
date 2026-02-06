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
 */
export function filterByCoach(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  // Admins see all, coaches see only their clients
  if (req.user.role === 'COACH') {
    // Attach coach filter to request for use in route handlers
    (req as any).coachFilter = { coachId: req.user.id };
  } else {
    (req as any).coachFilter = {};
  }

  next();
}
