import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../index.js';
import { authenticate } from '../middleware/auth.js';
import { canAccessClient } from '../middleware/rbac.js';
import { writeLimiter } from '../middleware/rateLimit.js';
import { validateBody, validateParams } from '../middleware/validate.js';
import { asyncHandler, createError } from '../middleware/errorHandler.js';
import { createAuditEntry } from '../middleware/requestLogger.js';

const router = Router();

router.use(authenticate);

// ===========================================
// VALIDATION SCHEMAS
// ===========================================

const createNoteSchema = z.object({
  content: z.string().min(1, 'Content is required').max(10000),
  tags: z.array(z.string()).optional().default([]),
  isPinned: z.boolean().optional().default(false),
  nextActionAt: z.string().datetime().optional(),
});

const updateNoteSchema = z.object({
  content: z.string().min(1).max(10000).optional(),
  tags: z.array(z.string()).optional(),
  isPinned: z.boolean().optional(),
  nextActionAt: z.string().datetime().nullable().optional(),
});

const clientIdParamSchema = z.object({
  clientId: z.string().min(1),
});

const noteIdParamSchema = z.object({
  clientId: z.string().min(1),
  noteId: z.string().min(1),
});

// ===========================================
// ROUTES
// ===========================================

/**
 * GET /api/clients/:clientId/notes
 * List notes for a client
 */
router.get(
  '/:clientId/notes',
  validateParams(clientIdParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { clientId } = req.params;

    // Fetch client to verify access
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

    const notes = await prisma.note.findMany({
      where: { clientId },
      include: {
        author: { select: { id: true, name: true, avatar: true } },
      },
      orderBy: [
        { isPinned: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    res.json({
      notes: notes.map((n) => ({
        id: n.id,
        content: n.content,
        tags: JSON.parse(n.tags || '[]'),
        isPinned: n.isPinned,
        nextActionAt: n.nextActionAt,
        createdAt: n.createdAt,
        updatedAt: n.updatedAt,
        author: n.author,
      })),
    });
  })
);

/**
 * POST /api/clients/:clientId/notes
 * Create a note for a client
 */
router.post(
  '/:clientId/notes',
  writeLimiter,
  validateParams(clientIdParamSchema),
  validateBody(createNoteSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { clientId } = req.params;
    const { content, tags, isPinned, nextActionAt } = req.body;

    // Fetch client to verify access
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

    // Create note and update client's lastContactDate
    const [note] = await prisma.$transaction([
      prisma.note.create({
        data: {
          clientId,
          authorId: req.user!.id,
          content,
          tags: JSON.stringify(tags),
          isPinned,
          nextActionAt: nextActionAt ? new Date(nextActionAt) : null,
        },
        include: {
          author: { select: { id: true, name: true, avatar: true } },
        },
      }),
      prisma.client.update({
        where: { id: clientId },
        data: {
          lastContactDate: new Date(),
          nextActionDate: nextActionAt ? new Date(nextActionAt) : undefined,
        },
      }),
    ]);

    // Audit log
    await prisma.auditLog.create({
      data: createAuditEntry(req.user!.id, 'CREATE', 'Note', note.id, { clientId }, req),
    });

    res.status(201).json({
      note: {
        id: note.id,
        content: note.content,
        tags: JSON.parse(note.tags || '[]'),
        isPinned: note.isPinned,
        nextActionAt: note.nextActionAt,
        createdAt: note.createdAt,
        author: note.author,
      },
    });
  })
);

/**
 * PATCH /api/clients/:clientId/notes/:noteId
 * Update a note
 */
router.patch(
  '/:clientId/notes/:noteId',
  writeLimiter,
  validateParams(noteIdParamSchema),
  validateBody(updateNoteSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { clientId, noteId } = req.params;
    const updates = req.body;

    // Fetch note with client info
    const note = await prisma.note.findUnique({
      where: { id: noteId },
      include: {
        client: { select: { coachId: true, isDeleted: true } },
      },
    });

    if (!note || note.clientId !== clientId || note.client.isDeleted) {
      throw createError('Note not found', 404);
    }

    const hasAccess = await canAccessClient(req.user!.id, req.user!.role, note.client.coachId);
    if (!hasAccess) {
      throw createError('Access denied', 403);
    }

    // Prepare update data
    const updateData: any = {};
    if (updates.content !== undefined) updateData.content = updates.content;
    if (updates.isPinned !== undefined) updateData.isPinned = updates.isPinned;
    if (updates.tags !== undefined) updateData.tags = JSON.stringify(updates.tags);
    if (updates.nextActionAt !== undefined) {
      updateData.nextActionAt = updates.nextActionAt ? new Date(updates.nextActionAt) : null;
    }

    const updatedNote = await prisma.note.update({
      where: { id: noteId },
      data: updateData,
      include: {
        author: { select: { id: true, name: true, avatar: true } },
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: createAuditEntry(req.user!.id, 'UPDATE', 'Note', noteId, updates, req),
    });

    res.json({
      note: {
        id: updatedNote.id,
        content: updatedNote.content,
        tags: JSON.parse(updatedNote.tags || '[]'),
        isPinned: updatedNote.isPinned,
        nextActionAt: updatedNote.nextActionAt,
        createdAt: updatedNote.createdAt,
        updatedAt: updatedNote.updatedAt,
        author: updatedNote.author,
      },
    });
  })
);

/**
 * DELETE /api/clients/:clientId/notes/:noteId
 * Delete a note
 */
router.delete(
  '/:clientId/notes/:noteId',
  writeLimiter,
  validateParams(noteIdParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { clientId, noteId } = req.params;

    // Fetch note with client info
    const note = await prisma.note.findUnique({
      where: { id: noteId },
      include: {
        client: { select: { coachId: true, isDeleted: true } },
      },
    });

    if (!note || note.clientId !== clientId || note.client.isDeleted) {
      throw createError('Note not found', 404);
    }

    const hasAccess = await canAccessClient(req.user!.id, req.user!.role, note.client.coachId);
    if (!hasAccess) {
      throw createError('Access denied', 403);
    }

    await prisma.note.delete({ where: { id: noteId } });

    // Audit log
    await prisma.auditLog.create({
      data: createAuditEntry(req.user!.id, 'DELETE', 'Note', noteId, { clientId }, req),
    });

    res.json({ message: 'Note deleted successfully' });
  })
);

export default router;
