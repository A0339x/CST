import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../index.js';
import { authenticate } from '../middleware/auth.js';
import { filterByCoach, canAccessClient } from '../middleware/rbac.js';
import { writeLimiter } from '../middleware/rateLimit.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validate.js';
import { asyncHandler, createError } from '../middleware/errorHandler.js';
import { createAuditEntry } from '../middleware/requestLogger.js';

const router = Router();

// All client routes require authentication
router.use(authenticate);

// ===========================================
// VALIDATION SCHEMAS
// ===========================================

const createClientSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  email: z.string().email('Invalid email'),
  timezone: z.string().default('UTC'),
  coachId: z.string().optional(), // If not provided, defaults to current user
  status: z.enum(['ONBOARDING', 'ACTIVE', 'AT_RISK', 'COMPLETED', 'PAUSED']).default('ONBOARDING'),
  onboardingStatus: z.enum(['NOT_BOOKED', 'BOOKED', 'COMPLETED', 'NO_SHOW']).default('NOT_BOOKED'),
  onboardingDateTime: z.string().datetime().optional(),
  tags: z.array(z.string()).optional(),
});

const updateClientSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  email: z.string().email().optional(),
  timezone: z.string().optional(),
  coachId: z.string().optional(),
  status: z.enum(['ONBOARDING', 'ACTIVE', 'AT_RISK', 'COMPLETED', 'PAUSED']).optional(),
  riskReason: z.string().nullable().optional(),
  onboardingStatus: z.enum(['NOT_BOOKED', 'BOOKED', 'COMPLETED', 'NO_SHOW']).optional(),
  onboardingDateTime: z.string().datetime().nullable().optional(),
  nextActionDate: z.string().datetime().nullable().optional(),
  tags: z.array(z.string()).optional(),
});

const listQuerySchema = z.object({
  page: z.string().optional().transform(v => v ? parseInt(v, 10) : 1),
  limit: z.string().optional().transform(v => v ? Math.min(parseInt(v, 10), 500) : 50),
  status: z.enum(['ONBOARDING', 'ACTIVE', 'AT_RISK', 'COMPLETED', 'PAUSED']).optional(),
  onboardingStatus: z.enum(['NOT_BOOKED', 'BOOKED', 'COMPLETED', 'NO_SHOW']).optional(),
  coachId: z.string().optional(),
  search: z.string().optional(),
  atRiskOnly: z.string().optional().transform(v => v === 'true'),
  myClientsOnly: z.string().optional(), // Filter to show only the coach's own clients
  sortBy: z.enum(['name', 'lastContactDate', 'createdAt', 'status']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

const idParamSchema = z.object({
  id: z.string().min(1),
});

// ===========================================
// ROUTES
// ===========================================

/**
 * GET /api/clients
 * List clients with filtering and pagination
 */
router.get(
  '/',
  filterByCoach,
  validateQuery(listQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const {
      page = 1,
      limit = 50,
      status,
      onboardingStatus,
      coachId,
      search,
      atRiskOnly,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query as any;

    // Build where clause
    const where: any = {
      isDeleted: false,
      ...(req as any).coachFilter, // Applied by filterByCoach middleware
    };

    if (status) where.status = status;
    if (onboardingStatus) where.onboardingStatus = onboardingStatus;
    if (coachId) where.coachId = coachId; // Any user can filter by coach
    if (atRiskOnly) where.status = 'AT_RISK';

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
      ];
    }

    // Get total count
    const total = await prisma.client.count({ where });

    // Get clients with pagination
    const clients = await prisma.client.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: {
        coach: {
          select: { id: true, name: true, avatar: true },
        },
        tags: {
          select: { name: true },
        },
        outcome: true,
        progress: {
          include: { step: true },
          orderBy: { step: { order: 'asc' } },
        },
        _count: {
          select: { notes: true },
        },
      },
    });

    // Transform response
    const clientsWithProgress = clients.map((client) => {
      const completedSteps = client.progress.filter((p) => p.isCompleted).length;
      const totalSteps = client.progress.length;

      return {
        id: client.id,
        name: client.name,
        email: client.email,
        timezone: client.timezone,
        status: client.status,
        riskReason: client.riskReason,
        onboardingStatus: client.onboardingStatus,
        onboardingDateTime: client.onboardingDateTime,
        lastContactDate: client.lastContactDate,
        nextActionDate: client.nextActionDate,
        createdAt: client.createdAt,
        coach: client.coach,
        tags: client.tags.map((t) => t.name),
        noteCount: client._count.notes,
        outcomes: client.outcome
          ? {
              hasReview: client.outcome.reviewDone,
              hasReferral: client.outcome.endorsementDone,
              isInnerCircle: client.outcome.innerCircleDone,
            }
          : { hasReview: false, hasReferral: false, isInnerCircle: false },
        currentStepIndex: completedSteps,
        totalSteps,
      };
    });

    res.json({
      clients: clientsWithProgress,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  })
);

/**
 * GET /api/clients/:id
 * Get single client with full details
 */
router.get(
  '/:id',
  validateParams(idParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const client = await prisma.client.findUnique({
      where: { id: req.params.id },
      include: {
        coach: {
          select: { id: true, name: true, email: true, avatar: true },
        },
        tags: true,
        notes: {
          include: {
            author: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        outcome: true,
        progress: {
          include: { step: true },
          orderBy: { step: { order: 'asc' } },
        },
        customFieldValues: {
          include: { fieldDef: true },
        },
      },
    });

    if (!client || client.isDeleted) {
      throw createError('Client not found', 404);
    }

    // Check access permission
    const hasAccess = await canAccessClient(req.user!.id, req.user!.role, client.coachId);
    if (!hasAccess) {
      throw createError('Access denied', 403);
    }

    // Transform response
    const response = {
      id: client.id,
      name: client.name,
      email: client.email,
      timezone: client.timezone,
      status: client.status,
      riskReason: client.riskReason,
      onboardingStatus: client.onboardingStatus,
      onboardingDateTime: client.onboardingDateTime,
      lastContactDate: client.lastContactDate,
      nextActionDate: client.nextActionDate,
      ghlContactId: client.ghlContactId,
      createdAt: client.createdAt,
      updatedAt: client.updatedAt,
      coach: client.coach,
      tags: client.tags.map((t) => t.name),
      notes: client.notes.map((n) => ({
        id: n.id,
        content: n.content,
        tags: JSON.parse(n.tags || '[]'),
        isPinned: n.isPinned,
        nextActionAt: n.nextActionAt,
        createdAt: n.createdAt,
        author: n.author,
      })),
      outcome: client.outcome,
      curriculum: client.progress.map((p) => ({
        id: p.step.id,
        order: p.step.order,
        title: p.step.title,
        isCompleted: p.isCompleted,
        completedAt: p.completedAt,
      })),
      customFields: client.customFieldValues.map((v) => ({
        id: v.fieldDef.id,
        name: v.fieldDef.name,
        type: v.fieldDef.type,
        value: v.value,
      })),
    };

    res.json({ client: response });
  })
);

/**
 * POST /api/clients
 * Create new client
 */
router.post(
  '/',
  writeLimiter,
  validateBody(createClientSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { name, email, timezone, coachId, status, onboardingStatus, onboardingDateTime, tags } = req.body;

    // Use current user as coach if not specified (and user is a coach)
    const assignedCoachId = coachId || (req.user!.role === 'COACH' ? req.user!.id : null);

    if (!assignedCoachId) {
      throw createError('Coach ID is required', 400);
    }

    // Verify coach exists
    const coach = await prisma.user.findUnique({
      where: { id: assignedCoachId },
    });

    if (!coach || !coach.isActive) {
      throw createError('Coach not found or inactive', 400);
    }

    // Check email uniqueness
    const existing = await prisma.client.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existing) {
      throw createError('Client with this email already exists', 409);
    }

    // Get all curriculum steps to initialize progress
    const curriculumSteps = await prisma.curriculumStep.findMany({
      orderBy: { order: 'asc' },
    });

    // Create client with progress initialized
    const client = await prisma.client.create({
      data: {
        name,
        email: email.toLowerCase(),
        timezone,
        coachId: assignedCoachId,
        status,
        onboardingStatus,
        onboardingDateTime: onboardingDateTime ? new Date(onboardingDateTime) : null,
        tags: tags
          ? {
              create: tags.map((tag: string) => ({ name: tag })),
            }
          : undefined,
        progress: {
          create: curriculumSteps.map((step) => ({
            stepId: step.id,
            isCompleted: false,
          })),
        },
        outcome: {
          create: {},
        },
      },
      include: {
        coach: { select: { id: true, name: true } },
        tags: true,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: createAuditEntry(req.user!.id, 'CREATE', 'Client', client.id, { coachId: assignedCoachId }, req),
    });

    res.status(201).json({
      client: {
        ...client,
        tags: client.tags.map((t) => t.name),
      },
    });
  })
);

/**
 * PATCH /api/clients/:id
 * Update client
 */
router.patch(
  '/:id',
  writeLimiter,
  validateParams(idParamSchema),
  validateBody(updateClientSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const updates = req.body;

    // Fetch client to check access
    const existing = await prisma.client.findUnique({
      where: { id },
    });

    if (!existing || existing.isDeleted) {
      throw createError('Client not found', 404);
    }

    // Check access
    const hasAccess = await canAccessClient(req.user!.id, req.user!.role, existing.coachId);
    if (!hasAccess) {
      throw createError('Access denied', 403);
    }

    // Handle tags separately
    const { tags, ...clientUpdates } = updates;

    // Prepare update data
    const updateData: any = { ...clientUpdates };

    // Convert date strings to Date objects
    if (updateData.onboardingDateTime) {
      updateData.onboardingDateTime = new Date(updateData.onboardingDateTime);
    }
    if (updateData.nextActionDate) {
      updateData.nextActionDate = new Date(updateData.nextActionDate);
    }

    // Check email uniqueness if updating
    if (updateData.email) {
      const emailInUse = await prisma.client.findFirst({
        where: {
          email: updateData.email.toLowerCase(),
          NOT: { id },
        },
      });

      if (emailInUse) {
        throw createError('Email already in use', 409);
      }

      updateData.email = updateData.email.toLowerCase();
    }

    // Update client
    const client = await prisma.client.update({
      where: { id },
      data: updateData,
      include: {
        coach: { select: { id: true, name: true } },
        tags: true,
      },
    });

    // Update tags if provided
    if (tags !== undefined) {
      // Delete existing tags
      await prisma.clientTag.deleteMany({ where: { clientId: id } });

      // Create new tags
      if (tags.length > 0) {
        await prisma.clientTag.createMany({
          data: tags.map((tag: string) => ({ clientId: id, name: tag })),
        });
      }
    }

    // Audit log
    await prisma.auditLog.create({
      data: createAuditEntry(req.user!.id, 'UPDATE', 'Client', id, updates, req),
    });

    // Fetch updated tags
    const updatedTags = await prisma.clientTag.findMany({
      where: { clientId: id },
    });

    res.json({
      client: {
        ...client,
        tags: updatedTags.map((t) => t.name),
      },
    });
  })
);

/**
 * DELETE /api/clients/:id
 * Soft delete client
 */
router.delete(
  '/:id',
  writeLimiter,
  validateParams(idParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    // Fetch client to check access
    const existing = await prisma.client.findUnique({
      where: { id },
    });

    if (!existing || existing.isDeleted) {
      throw createError('Client not found', 404);
    }

    // Only admins can delete
    if (req.user!.role !== 'ADMIN') {
      throw createError('Only admins can delete clients', 403);
    }

    // Soft delete
    await prisma.client.update({
      where: { id },
      data: { isDeleted: true },
    });

    // Audit log
    await prisma.auditLog.create({
      data: createAuditEntry(req.user!.id, 'DELETE', 'Client', id, undefined, req),
    });

    res.json({ message: 'Client deleted successfully' });
  })
);

export default router;
