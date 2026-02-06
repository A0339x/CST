import { WebClient } from '@slack/web-api';
import { prisma } from '../index.js';

const slack = new WebClient(process.env.SLACK_BOT_TOKEN);
const APP_BASE_URL = process.env.APP_BASE_URL || 'http://localhost:3000';

/**
 * Build and open a client detail modal in Slack
 */
export async function buildClientModal(clientId: string, triggerId: string): Promise<void> {
  if (!process.env.SLACK_BOT_TOKEN) {
    console.warn('Slack not configured');
    return;
  }

  // Fetch client details
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      coach: { select: { name: true } },
      notes: {
        include: { author: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 3,
      },
      outcome: true,
      progress: {
        where: { isCompleted: true },
      },
      _count: {
        select: { progress: true },
      },
    },
  });

  if (!client) {
    console.error('Client not found:', clientId);
    return;
  }

  // Format dates
  const lastContact = client.lastContactDate
    ? client.lastContactDate.toLocaleDateString()
    : 'Never';

  const nextAction = client.nextActionDate
    ? client.nextActionDate.toLocaleDateString()
    : 'Not set';

  // Build progress string
  const progressStr = `${client.progress.length}/${client._count.progress} steps completed`;

  // Build outcomes summary
  const outcomes = [];
  if (client.outcome?.reviewDone) outcomes.push('✅ Review');
  if (client.outcome?.endorsementDone) outcomes.push(`✅ ${client.outcome.endorsementCount} Endorsements`);
  if (client.outcome?.innerCircleDone) outcomes.push('✅ Inner Circle');
  const outcomesStr = outcomes.length > 0 ? outcomes.join(' | ') : 'No outcomes yet';

  // Build recent notes
  const notesBlocks = client.notes.map((note) => {
    const tags = JSON.parse(note.tags || '[]');
    const tagStr = tags.length > 0 ? ` [${tags.join(', ')}]` : '';
    const date = note.createdAt.toLocaleDateString();
    const content = note.content.length > 200
      ? note.content.substring(0, 200) + '...'
      : note.content;

    return {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${note.author.name}* - ${date}${tagStr}\n${content}`,
      },
    };
  });

  // Build modal view
  const view = {
    type: 'modal' as const,
    title: {
      type: 'plain_text' as const,
      text: client.name.substring(0, 24),
    },
    close: {
      type: 'plain_text' as const,
      text: 'Close',
    },
    blocks: [
      // Client info header
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Coach*\n${client.coach.name}` },
          { type: 'mrkdwn', text: `*Status*\n${client.status}` },
          { type: 'mrkdwn', text: `*Onboarding*\n${client.onboardingStatus}` },
          { type: 'mrkdwn', text: `*Timezone*\n${client.timezone}` },
        ],
      },

      { type: 'divider' },

      // Progress and dates
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Progress*\n${progressStr}` },
          { type: 'mrkdwn', text: `*Last Contact*\n${lastContact}` },
          { type: 'mrkdwn', text: `*Next Action*\n${nextAction}` },
        ],
      },

      // Risk reason if applicable
      ...(client.riskReason
        ? [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*⚠️ Risk Reason*\n${client.riskReason}`,
              },
            },
          ]
        : []),

      { type: 'divider' },

      // Outcomes
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Outcomes*\n${outcomesStr}`,
        },
      },

      { type: 'divider' },

      // Recent notes header
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Recent Notes*',
        },
      },

      // Notes content
      ...(notesBlocks.length > 0
        ? notesBlocks
        : [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: '_No notes yet_',
              },
            },
          ]),

      { type: 'divider' },

      // Open in app button
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '🔗 Open Client Profile',
            },
            url: `${APP_BASE_URL}/clients/${clientId}`,
            action_id: 'open_client_profile',
          },
        ],
      },
    ],
  };

  // Open modal
  await slack.views.open({
    trigger_id: triggerId,
    view,
  });
}

/**
 * Handle modal form submissions
 */
export async function handleModalAction(
  view: any,
  user: any
): Promise<{ response_action?: string }> {
  const callbackId = view?.callback_id;

  // Handle different modal submissions
  switch (callbackId) {
    case 'mark_contacted':
      // Future feature: Mark client as contacted
      return { response_action: 'clear' };

    case 'set_next_action':
      // Future feature: Set next action date
      return { response_action: 'clear' };

    default:
      return {};
  }
}
