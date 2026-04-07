import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../index.js';
import { authenticate } from '../middleware/auth.js';
import { filterByCoach } from '../middleware/rbac.js';
import { exportLimiter } from '../middleware/rateLimit.js';
import { validateQuery } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { createAuditEntry } from '../middleware/requestLogger.js';

const router = Router();

router.use(authenticate);
router.use(exportLimiter);

// ===========================================
// VALIDATION SCHEMAS
// ===========================================

const exportQuerySchema = z.object({
  format: z.enum(['csv', 'json']).default('csv'),
  status: z.enum(['ONBOARDING', 'ACTIVE', 'AT_RISK', 'COMPLETED', 'PAUSED']).optional(),
  coachId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

// ===========================================
// UTILITIES
// ===========================================

/**
 * Escape CSV field to prevent injection attacks
 */
function escapeCSVField(field: any): string {
  if (field === null || field === undefined) {
    return '';
  }

  const str = String(field);

  // Check for dangerous characters that could be injection vectors
  if (str.match(/^[=+\-@\t\r]/)) {
    // Prefix with single quote to neutralize formula injection
    return `"'${str.replace(/"/g, '""')}"`;
  }

  // If field contains comma, newline, or quote, wrap in quotes
  if (str.includes(',') || str.includes('\n') || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Convert array of objects to CSV string
 */
function toCSV(data: any[], columns: string[]): string {
  const header = columns.join(',');
  const rows = data.map((row) =>
    columns.map((col) => escapeCSVField(row[col])).join(',')
  );
  return [header, ...rows].join('\n');
}

// ===========================================
// ROUTES
// ===========================================

/**
 * GET /api/export/clients
 * Export clients as CSV or JSON
 */
router.get(
  '/clients',
  filterByCoach,
  validateQuery(exportQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { format, status, coachId } = req.query as any;

    // Build where clause
    const where: any = {
      isDeleted: false,
      ...(req as any).coachFilter,
    };

    if (status) where.status = status;
    if (coachId && req.user!.role === 'ADMIN') where.coachId = coachId;

    // Fetch clients
    const clients = await prisma.client.findMany({
      where,
      include: {
        coach: { select: { name: true, email: true } },
        tags: true,
        outcome: true,
        progress: {
          where: { isCompleted: true },
        },
        _count: {
          select: { notes: true, progress: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    // Transform data
    const exportData = clients.map((client) => ({
      id: client.id,
      name: client.name,
      email: client.email,
      timezone: client.timezone,
      status: client.status,
      risk_reason: client.riskReason || '',
      onboarding_status: client.onboardingStatus,
      onboarding_date: client.onboardingDateTime?.toISOString() || '',
      last_contact_date: client.lastContactDate?.toISOString() || '',
      next_action_date: client.nextActionDate?.toISOString() || '',
      coach_name: client.coach.name,
      coach_email: client.coach.email,
      tags: client.tags.map((t) => t.name).join('; '),
      note_count: client._count.notes,
      completed_steps: client.progress.length,
      total_steps: client._count.progress,
      review_done: client.outcome?.reviewDone ? 'Yes' : 'No',
      endorsement_done: client.outcome?.endorsementDone ? 'Yes' : 'No',
      endorsement_count: client.outcome?.endorsementCount || 0,
      inner_circle_done: client.outcome?.innerCircleDone ? 'Yes' : 'No',
      created_at: client.createdAt.toISOString(),
    }));

    // Audit log
    await prisma.auditLog.create({
      data: createAuditEntry(
        req.user!.id,
        'EXPORT',
        'Client',
        null,
        { format, count: exportData.length },
        req
      ),
    });

    if (format === 'json') {
      res.json({ clients: exportData });
    } else {
      const columns = [
        'id', 'name', 'email', 'timezone', 'status', 'risk_reason',
        'onboarding_status', 'onboarding_date', 'last_contact_date',
        'next_action_date', 'coach_name', 'coach_email', 'tags',
        'note_count', 'completed_steps', 'total_steps',
        'review_done', 'endorsement_done', 'endorsement_count',
        'inner_circle_done', 'created_at'
      ];

      const csv = toCSV(exportData, columns);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="clients.csv"');
      res.send(csv);
    }
  })
);

/**
 * GET /api/export/notes
 * Export notes as CSV or JSON
 */
router.get(
  '/notes',
  filterByCoach,
  validateQuery(exportQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { format, coachId, dateFrom, dateTo } = req.query as any;

    // Build client filter
    const clientWhere: any = {
      isDeleted: false,
      ...(req as any).coachFilter,
    };

    if (coachId && req.user!.role === 'ADMIN') {
      clientWhere.coachId = coachId;
    }

    // Build note-level date filter
    const noteWhere: any = { client: clientWhere };
    if (dateFrom || dateTo) {
      noteWhere.createdAt = {};
      if (dateFrom) noteWhere.createdAt.gte = new Date(dateFrom);
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        noteWhere.createdAt.lte = end;
      }
    }

    // Fetch notes for accessible clients
    const notes = await prisma.note.findMany({
      where: noteWhere,
      include: {
        client: {
          select: { name: true, email: true },
        },
        author: {
          select: { name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Transform data
    const exportData = notes.map((note) => ({
      id: note.id,
      client_name: note.client.name,
      client_email: note.client.email,
      author_name: note.author.name,
      author_email: note.author.email,
      content: note.content,
      tags: JSON.parse(note.tags || '[]').join('; '),
      is_pinned: note.isPinned ? 'Yes' : 'No',
      next_action_at: note.nextActionAt?.toISOString() || '',
      created_at: note.createdAt.toISOString(),
      updated_at: note.updatedAt.toISOString(),
    }));

    // Audit log
    await prisma.auditLog.create({
      data: createAuditEntry(
        req.user!.id,
        'EXPORT',
        'Note',
        null,
        { format, count: exportData.length },
        req
      ),
    });

    if (format === 'json') {
      res.json({ notes: exportData });
    } else {
      const columns = [
        'id', 'client_name', 'client_email', 'author_name', 'author_email',
        'content', 'tags', 'is_pinned', 'next_action_at', 'created_at', 'updated_at'
      ];

      const csv = toCSV(exportData, columns);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="notes.csv"');
      res.send(csv);
    }
  })
);

export default router;
