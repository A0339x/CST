import { WebClient } from '@slack/web-api';
import { prisma } from '../index.js';

// Initialize Slack client
const slack = new WebClient(process.env.SLACK_BOT_TOKEN);
const CHANNEL_ID = process.env.SLACK_CHANNEL_ID || '';
const APP_BASE_URL = process.env.APP_BASE_URL || 'http://localhost:3000';

/**
 * Send the daily heartbeat message to Slack
 */
export async function sendHeartbeat(): Promise<void> {
  if (!process.env.SLACK_BOT_TOKEN || !CHANNEL_ID) {
    console.warn('Slack not configured, skipping heartbeat');
    return;
  }

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Fetch stats
  const [
    totalClients,
    atRiskClients,
    notBookedOnboarding,
    noShowClients,
    recentContacts,
    coachStats,
    topAtRiskClients,
  ] = await Promise.all([
    prisma.client.count({ where: { isDeleted: false } }),
    prisma.client.count({ where: { isDeleted: false, status: 'AT_RISK' } }),
    prisma.client.count({
      where: { isDeleted: false, status: 'ONBOARDING', onboardingStatus: 'NOT_BOOKED' },
    }),
    prisma.client.count({ where: { isDeleted: false, onboardingStatus: 'NO_SHOW' } }),
    prisma.client.count({
      where: { isDeleted: false, lastContactDate: { gte: sevenDaysAgo } },
    }),
    prisma.user.findMany({
      where: { role: 'COACH', isActive: true },
      select: {
        name: true,
        clients: {
          where: { isDeleted: false },
          select: { status: true, lastContactDate: true },
        },
      },
    }),
    prisma.client.findMany({
      where: {
        isDeleted: false,
        OR: [
          { status: 'AT_RISK' },
          { onboardingStatus: 'NO_SHOW' },
          { status: 'ONBOARDING', onboardingStatus: 'NOT_BOOKED' },
        ],
      },
      include: {
        coach: { select: { name: true } },
        progress: { where: { isCompleted: true } },
        _count: { select: { progress: true } },
      },
      orderBy: { lastContactDate: 'asc' },
      take: 10,
    }),
  ]);

  // Format date
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  // Build coach breakdown text
  const coachBreakdownText = coachStats
    .map((coach) => {
      const total = coach.clients.length;
      const atRisk = coach.clients.filter((c) => c.status === 'AT_RISK').length;
      const stale = coach.clients.filter(
        (c) => c.lastContactDate && c.lastContactDate < sevenDaysAgo
      ).length;
      return `• *${coach.name}*: ${total} clients | ${atRisk} at-risk | ${stale} stale`;
    })
    .join('\n');

  // Build at-risk client list
  const atRiskListText = topAtRiskClients
    .map((client) => {
      const progress = `${client.progress.length}/${client._count.progress}`;
      return `• *${client.name}* (${client.coach.name}) - ${client.status} - Step ${progress}`;
    })
    .join('\n') || '_No at-risk clients_';

  // Build client select options (max 25 per Slack)
  const clientOptions = topAtRiskClients.slice(0, 25).map((client) => ({
    text: {
      type: 'plain_text' as const,
      text: `${client.name} (${client.coach.name})`,
    },
    value: client.id,
  }));

  // Build Block Kit message
  const blocks = [
    // Header
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `📊 Mastermind Heartbeat — ${dateStr}`,
        emoji: true,
      },
    },

    // Summary metrics
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Total Clients*\n${totalClients}` },
        { type: 'mrkdwn', text: `*At Risk*\n${atRiskClients}` },
        { type: 'mrkdwn', text: `*Not Booked*\n${notBookedOnboarding}` },
        { type: 'mrkdwn', text: `*No Shows*\n${noShowClients}` },
        { type: 'mrkdwn', text: `*Contacted (7d)*\n${recentContacts}` },
      ],
    },

    { type: 'divider' },

    // Coach breakdown
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Coach Breakdown*\n${coachBreakdownText}`,
      },
    },

    { type: 'divider' },

    // At-risk clients
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*⚠️ At-Risk Clients (Top 10)*\n${atRiskListText}`,
      },
    },

    { type: 'divider' },

    // Client select dropdown
    ...(clientOptions.length > 0
      ? [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '*View Client Details*',
            },
            accessory: {
              type: 'static_select',
              placeholder: {
                type: 'plain_text',
                text: 'Select a client...',
              },
              options: clientOptions,
              action_id: 'view_client_select',
            },
          },
        ]
      : []),

    // Action buttons
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: '🔴 Open Dashboard (At-Risk)',
          },
          url: `${APP_BASE_URL}/dashboard?atRisk=true`,
          action_id: 'open_dashboard_at_risk',
        },
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: '📋 Open Full Dashboard',
          },
          url: `${APP_BASE_URL}/dashboard`,
          action_id: 'open_dashboard',
        },
      ],
    },

    // Footer
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `Generated at ${now.toLocaleTimeString()} | <${APP_BASE_URL}|Open App>`,
        },
      ],
    },
  ];

  // Send message
  await slack.chat.postMessage({
    channel: CHANNEL_ID,
    text: `Mastermind Heartbeat — ${dateStr}`,
    blocks,
  });

  console.log('Heartbeat sent to Slack');
}

/**
 * Schedule daily heartbeat
 */
export function scheduleHeartbeat(): void {
  if (process.env.HEARTBEAT_ENABLED !== 'true') {
    console.log('Heartbeat scheduling disabled');
    return;
  }

  const time = process.env.HEARTBEAT_TIME_LOCAL || '09:00';
  const timezone = process.env.HEARTBEAT_TIMEZONE || 'America/Los_Angeles';

  // Dynamic import for node-cron (ES module)
  import('node-cron').then((cron) => {
    const [hour, minute] = time.split(':');

    // Cron expression: minute hour * * * (every day at specified time)
    const cronExpression = `${minute} ${hour} * * *`;

    cron.default.schedule(
      cronExpression,
      async () => {
        console.log('Running scheduled heartbeat...');
        try {
          await sendHeartbeat();

          // Log success
          await prisma.auditLog.create({
            data: {
              action: 'HEARTBEAT_SENT',
              metadata: JSON.stringify({ scheduled: true }),
            },
          });
        } catch (error: any) {
          console.error('Scheduled heartbeat failed:', error);

          // Log failure
          await prisma.auditLog.create({
            data: {
              action: 'HEARTBEAT_FAILED',
              metadata: JSON.stringify({ error: error.message, scheduled: true }),
            },
          });
        }
      },
      {
        timezone,
      }
    );

    console.log(`Heartbeat scheduled for ${time} ${timezone}`);
  });
}
