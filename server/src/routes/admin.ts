import { Router, Request, Response } from 'express';
import { prisma } from '../index.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/rbac.js';
import { writeLimiter } from '../middleware/rateLimit.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { createAuditEntry } from '../middleware/requestLogger.js';
import { sendHeartbeat } from '../slack/heartbeat.js';
import { syncFromGHL } from '../services/ghl.js';

const router = Router();

router.use(authenticate);
router.use(requireAdmin);

// ===========================================
// ROUTES
// ===========================================

/**
 * GET /api/admin/stats
 * Get dashboard statistics
 */
router.get(
  '/stats',
  asyncHandler(async (req: Request, res: Response) => {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Run queries in parallel
    const [
      totalClients,
      atRiskClients,
      onboardingClients,
      activeClients,
      completedClients,
      notBookedOnboarding,
      noShowOnboarding,
      recentContacts,
      coachStats,
    ] = await Promise.all([
      // Total active clients
      prisma.client.count({ where: { isDeleted: false } }),

      // At risk clients
      prisma.client.count({ where: { isDeleted: false, status: 'AT_RISK' } }),

      // Onboarding clients
      prisma.client.count({ where: { isDeleted: false, status: 'ONBOARDING' } }),

      // Active clients
      prisma.client.count({ where: { isDeleted: false, status: 'ACTIVE' } }),

      // Completed clients
      prisma.client.count({ where: { isDeleted: false, status: 'COMPLETED' } }),

      // Not booked onboarding
      prisma.client.count({
        where: {
          isDeleted: false,
          status: 'ONBOARDING',
          onboardingStatus: 'NOT_BOOKED',
        },
      }),

      // No show onboarding
      prisma.client.count({
        where: {
          isDeleted: false,
          onboardingStatus: 'NO_SHOW',
        },
      }),

      // Contacted in last 7 days
      prisma.client.count({
        where: {
          isDeleted: false,
          lastContactDate: { gte: sevenDaysAgo },
        },
      }),

      // Stats per coach
      prisma.user.findMany({
        where: { role: 'COACH', isActive: true },
        select: {
          id: true,
          name: true,
          _count: {
            select: { clients: { where: { isDeleted: false } } },
          },
          clients: {
            where: { isDeleted: false },
            select: {
              status: true,
              lastContactDate: true,
            },
          },
        },
      }),
    ]);

    // Process coach stats
    const coachBreakdown = coachStats.map((coach) => {
      const atRisk = coach.clients.filter((c) => c.status === 'AT_RISK').length;
      const stale = coach.clients.filter((c) =>
        c.lastContactDate && c.lastContactDate < sevenDaysAgo
      ).length;

      return {
        id: coach.id,
        name: coach.name,
        totalClients: coach._count.clients,
        atRiskCount: atRisk,
        staleCount: stale,
      };
    });

    res.json({
      summary: {
        totalClients,
        atRiskClients,
        onboardingClients,
        activeClients,
        completedClients,
        notBookedOnboarding,
        noShowOnboarding,
        recentContacts,
      },
      coaches: coachBreakdown,
      generatedAt: now.toISOString(),
    });
  })
);

/**
 * GET /api/admin/at-risk
 * Get detailed list of at-risk clients
 */
router.get(
  '/at-risk',
  asyncHandler(async (req: Request, res: Response) => {
    const clients = await prisma.client.findMany({
      where: {
        isDeleted: false,
        OR: [
          { status: 'AT_RISK' },
          { onboardingStatus: 'NO_SHOW' },
          {
            status: 'ONBOARDING',
            onboardingStatus: 'NOT_BOOKED',
          },
        ],
      },
      include: {
        coach: { select: { id: true, name: true } },
        progress: {
          where: { isCompleted: true },
        },
        _count: {
          select: { progress: true },
        },
      },
      orderBy: { lastContactDate: 'asc' },
      take: 50,
    });

    res.json({
      clients: clients.map((c) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        status: c.status,
        riskReason: c.riskReason,
        onboardingStatus: c.onboardingStatus,
        lastContactDate: c.lastContactDate,
        coach: c.coach,
        completedSteps: c.progress.length,
        totalSteps: c._count.progress,
      })),
    });
  })
);

/**
 * POST /api/admin/heartbeat/send
 * Manually trigger Slack heartbeat
 */
router.post(
  '/heartbeat/send',
  writeLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      await sendHeartbeat();

      // Audit log
      await prisma.auditLog.create({
        data: createAuditEntry(req.user!.id, 'HEARTBEAT_SENT', null, null, { manual: true }, req),
      });

      res.json({ message: 'Heartbeat sent successfully' });
    } catch (error: any) {
      // Log failure
      await prisma.auditLog.create({
        data: createAuditEntry(
          req.user!.id,
          'HEARTBEAT_FAILED',
          null,
          null,
          { error: error.message, manual: true },
          req
        ),
      });

      throw error;
    }
  })
);

/**
 * POST /api/admin/ghl/sync
 * Trigger Go High Level sync
 */
router.post(
  '/ghl/sync',
  writeLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const result = await syncFromGHL();

    // Audit log
    await prisma.auditLog.create({
      data: createAuditEntry(req.user!.id, 'GHL_SYNC', null, null, result, req),
    });

    res.json({
      message: 'GHL sync completed',
      ...result,
    });
  })
);

/**
 * GET /api/admin/audit-logs
 * Get audit logs (Admin only)
 */
router.get(
  '/audit-logs',
  asyncHandler(async (req: Request, res: Response) => {
    const { action, userId, limit = '100', offset = '0' } = req.query;

    const where: any = {};
    if (action) where.action = action;
    if (userId) where.userId = userId;

    const logs = await prisma.auditLog.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string, 10),
      skip: parseInt(offset as string, 10),
    });

    const total = await prisma.auditLog.count({ where });

    res.json({
      logs: logs.map((log) => ({
        ...log,
        metadata: log.metadata ? JSON.parse(log.metadata) : null,
      })),
      total,
    });
  })
);

export default router;
