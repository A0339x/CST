import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../index.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/rbac.js';
import { writeLimiter } from '../middleware/rateLimit.js';
import { validateBody, validateParams } from '../middleware/validate.js';
import { asyncHandler, createError } from '../middleware/errorHandler.js';
import { createAuditEntry } from '../middleware/requestLogger.js';

const router = Router();

// All user routes require authentication and admin role
router.use(authenticate);
router.use(requireAdmin);

// ===========================================
// VALIDATION SCHEMAS
// ===========================================

const createUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name is required').max(100, 'Name is too long'),
  role: z.enum(['ADMIN', 'COACH']),
  avatar: z.string().url().optional(),
});

const updateUserSchema = z.object({
  email: z.string().email('Invalid email address').optional(),
  name: z.string().min(1, 'Name is required').max(100, 'Name is too long').optional(),
  role: z.enum(['ADMIN', 'COACH']).optional(),
  avatar: z.string().url().nullable().optional(),
  isActive: z.boolean().optional(),
});

const idParamSchema = z.object({
  id: z.string().min(1, 'User ID is required'),
});

// ===========================================
// ROUTES
// ===========================================

/**
 * GET /api/users
 * List all users (Admin only)
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const { role, isActive, search } = req.query;

    const where: any = {};

    if (role) {
      where.role = role;
    }

    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    if (search) {
      where.OR = [
        { name: { contains: search as string } },
        { email: { contains: search as string } },
      ];
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        isActive: true,
        createdAt: true,
        _count: {
          select: { clients: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    res.json({
      users: users.map((u) => ({
        ...u,
        clientCount: u._count.clients,
        _count: undefined,
      })),
    });
  })
);

/**
 * GET /api/users/:id
 * Get single user (Admin only)
 */
router.get(
  '/:id',
  validateParams(idParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { clients: true, notes: true },
        },
      },
    });

    if (!user) {
      throw createError('User not found', 404);
    }

    res.json({
      user: {
        ...user,
        clientCount: user._count.clients,
        noteCount: user._count.notes,
        _count: undefined,
      },
    });
  })
);

/**
 * POST /api/users
 * Create new user (Admin only)
 */
router.post(
  '/',
  writeLimiter,
  validateBody(createUserSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { email, password, name, role, avatar } = req.body;

    // Check if email already exists
    const existing = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existing) {
      throw createError('Email already in use', 409);
    }

    // Hash password
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        name,
        role,
        avatar,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        isActive: true,
        createdAt: true,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: createAuditEntry(req.user!.id, 'CREATE', 'User', user.id, { role }, req),
    });

    res.status(201).json({ user });
  })
);

/**
 * PATCH /api/users/:id
 * Update user (Admin only)
 */
router.patch(
  '/:id',
  writeLimiter,
  validateParams(idParamSchema),
  validateBody(updateUserSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const updates = req.body;

    // Check user exists
    const existing = await prisma.user.findUnique({
      where: { id },
    });

    if (!existing) {
      throw createError('User not found', 404);
    }

    // If updating email, check it's not in use
    if (updates.email) {
      const emailInUse = await prisma.user.findFirst({
        where: {
          email: updates.email.toLowerCase(),
          NOT: { id },
        },
      });

      if (emailInUse) {
        throw createError('Email already in use', 409);
      }

      updates.email = updates.email.toLowerCase();
    }

    // Update user
    const user = await prisma.user.update({
      where: { id },
      data: updates,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: createAuditEntry(req.user!.id, 'UPDATE', 'User', id, updates, req),
    });

    res.json({ user });
  })
);

/**
 * DELETE /api/users/:id
 * Deactivate user (Admin only) - soft delete
 */
router.delete(
  '/:id',
  writeLimiter,
  validateParams(idParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    // Prevent self-deactivation
    if (id === req.user!.id) {
      throw createError('Cannot deactivate your own account', 400);
    }

    // Check user exists
    const existing = await prisma.user.findUnique({
      where: { id },
    });

    if (!existing) {
      throw createError('User not found', 404);
    }

    // Soft delete - set isActive to false
    await prisma.user.update({
      where: { id },
      data: { isActive: false },
    });

    // Audit log
    await prisma.auditLog.create({
      data: createAuditEntry(req.user!.id, 'DELETE', 'User', id, undefined, req),
    });

    res.json({ message: 'User deactivated successfully' });
  })
);

/**
 * POST /api/users/:id/reset-password
 * Reset user's password (Admin only)
 */
const resetPasswordSchema = z.object({
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

router.post(
  '/:id/reset-password',
  writeLimiter,
  validateParams(idParamSchema),
  validateBody(resetPasswordSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { newPassword } = req.body;

    // Check user exists
    const existing = await prisma.user.findUnique({
      where: { id },
    });

    if (!existing) {
      throw createError('User not found', 404);
    }

    // Hash new password
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    // Update password
    await prisma.user.update({
      where: { id },
      data: { passwordHash },
    });

    // Audit log
    await prisma.auditLog.create({
      data: createAuditEntry(req.user!.id, 'UPDATE', 'User', id, { action: 'password_reset' }, req),
    });

    res.json({ message: 'Password reset successfully' });
  })
);

export default router;
