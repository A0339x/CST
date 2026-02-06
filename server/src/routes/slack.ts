import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../index.js';
import { slackLimiter } from '../middleware/rateLimit.js';
import { asyncHandler, createError } from '../middleware/errorHandler.js';
import { createAuditEntry } from '../middleware/requestLogger.js';
import { buildClientModal, handleModalAction } from '../slack/modals.js';

const router = Router();

// Apply Slack rate limiter
router.use(slackLimiter);

// ===========================================
// SLACK SIGNATURE VERIFICATION
// ===========================================

const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET || '';

/**
 * Verify Slack request signature
 */
function verifySlackSignature(req: Request): boolean {
  if (!SLACK_SIGNING_SECRET) {
    // SECURITY: In production, reject requests if signing secret is not configured
    if (process.env.NODE_ENV === 'production') {
      console.error('SLACK_SIGNING_SECRET not configured - rejecting request');
      return false;
    }
    console.warn('SLACK_SIGNING_SECRET not configured - skipping verification (dev mode)');
    return true;
  }

  const timestamp = req.headers['x-slack-request-timestamp'] as string;
  const signature = req.headers['x-slack-signature'] as string;

  if (!timestamp || !signature) {
    return false;
  }

  // Check timestamp is not too old (5 minutes)
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp, 10)) > 300) {
    return false;
  }

  // Compute signature
  const sigBasestring = `v0:${timestamp}:${JSON.stringify(req.body)}`;
  const mySignature = 'v0=' + crypto
    .createHmac('sha256', SLACK_SIGNING_SECRET)
    .update(sigBasestring)
    .digest('hex');

  // Constant-time comparison
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(mySignature)
  );
}

// ===========================================
// ROUTES
// ===========================================

/**
 * POST /api/slack/interactions
 * Handle Slack interactive components (buttons, menus, modals)
 */
router.post(
  '/interactions',
  asyncHandler(async (req: Request, res: Response) => {
    // Verify signature
    if (!verifySlackSignature(req)) {
      throw createError('Invalid Slack signature', 403);
    }

    // Parse payload (Slack sends as form-urlencoded with JSON payload)
    let payload;
    try {
      payload = JSON.parse(req.body.payload || req.body);
    } catch {
      payload = req.body;
    }

    const { type, user, actions, trigger_id, view } = payload;

    // Handle different interaction types
    switch (type) {
      case 'block_actions': {
        // Handle button/menu actions
        const action = actions?.[0];
        if (!action) {
          res.json({ ok: true });
          return;
        }

        const actionId = action.action_id;

        if (actionId === 'view_client_select') {
          // User selected a client from dropdown
          const clientId = action.selected_option?.value;

          if (clientId && trigger_id) {
            await buildClientModal(clientId, trigger_id);

            // Audit log
            await prisma.auditLog.create({
              data: {
                action: 'SLACK_MODAL_OPENED',
                resourceType: 'Client',
                resourceId: clientId,
                metadata: JSON.stringify({
                  slackUserId: user?.id,
                  slackUsername: user?.username,
                }),
              },
            });
          }
        }

        res.json({ ok: true });
        return;
      }

      case 'view_submission': {
        // Handle modal form submissions
        const result = await handleModalAction(view, user);
        res.json(result);
        return;
      }

      case 'shortcut':
      case 'message_action': {
        // Handle shortcuts (future feature)
        res.json({ ok: true });
        return;
      }

      default:
        res.json({ ok: true });
    }
  })
);

/**
 * POST /api/slack/events
 * Handle Slack Events API (optional, for future features)
 */
router.post(
  '/events',
  asyncHandler(async (req: Request, res: Response) => {
    // Verify signature
    if (!verifySlackSignature(req)) {
      throw createError('Invalid Slack signature', 403);
    }

    const { type, challenge, event } = req.body;

    // Handle URL verification challenge
    if (type === 'url_verification') {
      res.json({ challenge });
      return;
    }

    // Handle events
    if (type === 'event_callback') {
      // Process event asynchronously
      // Add event handlers here as needed
      console.log('Slack event received:', event?.type);
    }

    res.json({ ok: true });
  })
);

/**
 * GET /api/slack/health
 * Health check for Slack integration
 */
router.get(
  '/health',
  asyncHandler(async (req: Request, res: Response) => {
    const isConfigured = !!(
      process.env.SLACK_BOT_TOKEN &&
      process.env.SLACK_SIGNING_SECRET &&
      process.env.SLACK_CHANNEL_ID
    );

    res.json({
      status: isConfigured ? 'configured' : 'not_configured',
      botToken: !!process.env.SLACK_BOT_TOKEN,
      signingSecret: !!process.env.SLACK_SIGNING_SECRET,
      channelId: !!process.env.SLACK_CHANNEL_ID,
    });
  })
);

export default router;
