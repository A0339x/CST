import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../index.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin, canAccessClient } from '../middleware/rbac.js';
import { writeLimiter } from '../middleware/rateLimit.js';
import { validateBody, validateParams } from '../middleware/validate.js';
import { asyncHandler, createError } from '../middleware/errorHandler.js';
import { createAuditEntry } from '../middleware/requestLogger.js';

const router = Router();

router.use(authenticate);

// ===========================================
// VALIDATION SCHEMAS
// ===========================================

const createStepSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  order: z.number().int().min(0).optional(),
});

const updateStepSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  order: z.number().int().min(0).optional(),
});

const updateProgressSchema = z.object({
  isCompleted: z.boolean(),
});

const idParamSchema = z.object({
  id: z.string().min(1),
});

const progressParamSchema = z.object({
  clientId: z.string().min(1),
  stepId: z.string().min(1),
});

// ===========================================
// CURRICULUM STEP ROUTES (Admin management)
// ===========================================

/**
 * GET /api/curriculum
 * List all curriculum steps
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const steps = await prisma.curriculumStep.findMany({
      orderBy: { order: 'asc' },
    });

    res.json({ steps });
  })
);

/**
 * POST /api/curriculum
 * Create a new curriculum step (Admin only)
 */
router.post(
  '/',
  requireAdmin,
  writeLimiter,
  validateBody(createStepSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { title, order } = req.body;

    // If no order specified, add at the end
    let stepOrder = order;
    if (stepOrder === undefined) {
      const lastStep = await prisma.curriculumStep.findFirst({
        orderBy: { order: 'desc' },
      });
      stepOrder = lastStep ? lastStep.order + 1 : 0;
    }

    const step = await prisma.curriculumStep.create({
      data: { title, order: stepOrder },
    });

    // Create progress entries for all existing clients
    const clients = await prisma.client.findMany({
      where: { isDeleted: false },
      select: { id: true },
    });

    if (clients.length > 0) {
      await prisma.clientProgress.createMany({
        data: clients.map((client) => ({
          clientId: client.id,
          stepId: step.id,
          isCompleted: false,
        })),
      });
    }

    // Audit log
    await prisma.auditLog.create({
      data: createAuditEntry(req.user!.id, 'CREATE', 'CurriculumStep', step.id, { title, order: stepOrder }, req),
    });

    res.status(201).json({ step });
  })
);

/**
 * PATCH /api/curriculum/:id
 * Update a curriculum step (Admin only)
 */
router.patch(
  '/:id',
  requireAdmin,
  writeLimiter,
  validateParams(idParamSchema),
  validateBody(updateStepSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const updates = req.body;

    const existing = await prisma.curriculumStep.findUnique({ where: { id } });
    if (!existing) {
      throw createError('Curriculum step not found', 404);
    }

    const step = await prisma.curriculumStep.update({
      where: { id },
      data: updates,
    });

    // Audit log
    await prisma.auditLog.create({
      data: createAuditEntry(req.user!.id, 'UPDATE', 'CurriculumStep', id, updates, req),
    });

    res.json({ step });
  })
);

/**
 * DELETE /api/curriculum/:id
 * Delete a curriculum step (Admin only)
 */
router.delete(
  '/:id',
  requireAdmin,
  writeLimiter,
  validateParams(idParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const existing = await prisma.curriculumStep.findUnique({ where: { id } });
    if (!existing) {
      throw createError('Curriculum step not found', 404);
    }

    // Delete step (will cascade delete progress entries)
    await prisma.curriculumStep.delete({ where: { id } });

    // Audit log
    await prisma.auditLog.create({
      data: createAuditEntry(req.user!.id, 'DELETE', 'CurriculumStep', id, undefined, req),
    });

    res.json({ message: 'Curriculum step deleted successfully' });
  })
);

// ===========================================
// CLIENT PROGRESS ROUTES
// ===========================================

/**
 * GET /api/clients/:clientId/progress
 * Get client's curriculum progress
 */
router.get(
  '/clients/:clientId/progress',
  asyncHandler(async (req: Request, res: Response) => {
    const { clientId } = req.params;

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, coachId: true, isDeleted: true },
    });

    if (!client || client.isDeleted) {
      throw createError('Client not found', 404);
    }

    const hasAccess = await canAccessClient(req.user!.id, req.user!.role, client.coachId);
    if (!hasAccess) {
      throw createError('Access denied', 403);
    }

    const progress = await prisma.clientProgress.findMany({
      where: { clientId },
      include: { step: true },
      orderBy: { step: { order: 'asc' } },
    });

    res.json({
      progress: progress.map((p) => ({
        stepId: p.stepId,
        order: p.step.order,
        title: p.step.title,
        isCompleted: p.isCompleted,
        completedAt: p.completedAt,
      })),
    });
  })
);

/**
 * PATCH /api/clients/:clientId/progress/:stepId
 * Update client's progress for a specific step
 */
router.patch(
  '/clients/:clientId/progress/:stepId',
  writeLimiter,
  validateParams(progressParamSchema),
  validateBody(updateProgressSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { clientId, stepId } = req.params;
    const { isCompleted } = req.body;

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, coachId: true, isDeleted: true },
    });

    if (!client || client.isDeleted) {
      throw createError('Client not found', 404);
    }

    const hasAccess = await canAccessClient(req.user!.id, req.user!.role, client.coachId);
    if (!hasAccess) {
      throw createError('Access denied', 403);
    }

    // Find or create progress entry
    const existing = await prisma.clientProgress.findUnique({
      where: {
        clientId_stepId: { clientId, stepId },
      },
    });

    if (!existing) {
      throw createError('Progress entry not found', 404);
    }

    const progress = await prisma.clientProgress.update({
      where: {
        clientId_stepId: { clientId, stepId },
      },
      data: {
        isCompleted,
        completedAt: isCompleted ? new Date() : null,
      },
      include: { step: true },
    });

    // Audit log
    await prisma.auditLog.create({
      data: createAuditEntry(req.user!.id, 'UPDATE', 'ClientProgress', `${clientId}:${stepId}`, { isCompleted }, req),
    });

    res.json({
      progress: {
        stepId: progress.stepId,
        order: progress.step.order,
        title: progress.step.title,
        isCompleted: progress.isCompleted,
        completedAt: progress.completedAt,
      },
    });
  })
);

// ===========================================
// OUTCOMES ROUTES
// ===========================================

const updateOutcomeSchema = z.object({
  reviewStatus: z.enum(['POTENTIAL', 'NOT_YET', 'MAYBE_LATER', 'IN_PROGRESS', 'DONE']).optional(),
  reviewDone: z.boolean().optional(),
  endorsementStatus: z.enum(['POTENTIAL', 'NOT_YET', 'MAYBE_LATER', 'IN_PROGRESS', 'DONE']).optional(),
  endorsementCount: z.number().int().min(0).max(10).optional(),
  endorsementDone: z.boolean().optional(),
  innerCircleStatus: z.enum(['POTENTIAL', 'NOT_YET', 'MAYBE_LATER', 'IN_PROGRESS', 'DONE']).optional(),
  innerCircleDone: z.boolean().optional(),
});

/**
 * GET /api/clients/:clientId/outcomes
 * Get client's outcomes
 */
router.get(
  '/clients/:clientId/outcomes',
  asyncHandler(async (req: Request, res: Response) => {
    const { clientId } = req.params;

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      include: { outcome: true },
    });

    if (!client || client.isDeleted) {
      throw createError('Client not found', 404);
    }

    const hasAccess = await canAccessClient(req.user!.id, req.user!.role, client.coachId);
    if (!hasAccess) {
      throw createError('Access denied', 403);
    }

    res.json({ outcome: client.outcome });
  })
);

/**
 * PUT /api/clients/:clientId/outcomes
 * Update client's outcomes
 */
router.put(
  '/clients/:clientId/outcomes',
  writeLimiter,
  validateBody(updateOutcomeSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { clientId } = req.params;
    const updates = req.body;

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, coachId: true, isDeleted: true },
    });

    if (!client || client.isDeleted) {
      throw createError('Client not found', 404);
    }

    const hasAccess = await canAccessClient(req.user!.id, req.user!.role, client.coachId);
    if (!hasAccess) {
      throw createError('Access denied', 403);
    }

    // Upsert outcome
    const outcome = await prisma.outcome.upsert({
      where: { clientId },
      update: updates,
      create: {
        clientId,
        ...updates,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: createAuditEntry(req.user!.id, 'UPDATE', 'Outcome', clientId, updates, req),
    });

    res.json({ outcome });
  })
);

export default router;
