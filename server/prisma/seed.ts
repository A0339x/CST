import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const CURRICULUM_STEPS = [
  'Welcome & Vision Setting',
  'Wallet Security Fundamentals',
  'Exchange Setup & KYC',
  'Liquidity Strategy 101',
  'First Deployment',
  'Advanced Yield Farming',
  'Risk Management',
  'Tax & Compliance',
  'Scaling Operations',
  'Mastermind Graduation',
];

async function main() {
  console.log('Seeding database...');

  // Create curriculum steps
  console.log('Creating curriculum steps...');
  for (let i = 0; i < CURRICULUM_STEPS.length; i++) {
    await prisma.curriculumStep.upsert({
      where: { id: `step-${i + 1}` },
      update: { title: CURRICULUM_STEPS[i], order: i },
      create: {
        id: `step-${i + 1}`,
        title: CURRICULUM_STEPS[i],
        order: i,
      },
    });
  }

  // Create admin user
  console.log('Creating admin user...');
  const adminPassword = await bcrypt.hash('admin123', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@mastermind.com' },
    update: {},
    create: {
      email: 'admin@mastermind.com',
      passwordHash: adminPassword,
      name: 'Admin User',
      role: 'ADMIN',
      avatar: 'https://i.pravatar.cc/150?u=admin',
    },
  });

  // Create coach users
  console.log('Creating coach users...');
  const coachPassword = await bcrypt.hash('coach123', 12);

  const sarahCoach = await prisma.user.upsert({
    where: { email: 'sarah@mastermind.com' },
    update: {},
    create: {
      email: 'sarah@mastermind.com',
      passwordHash: coachPassword,
      name: 'Sarah Jenkins',
      role: 'COACH',
      avatar: 'https://i.pravatar.cc/150?u=sarah',
    },
  });

  const mikeCoach = await prisma.user.upsert({
    where: { email: 'mike@mastermind.com' },
    update: {},
    create: {
      email: 'mike@mastermind.com',
      passwordHash: coachPassword,
      name: 'Mike Ross',
      role: 'COACH',
      avatar: 'https://i.pravatar.cc/150?u=mike',
    },
  });

  // Get curriculum steps for client progress
  const steps = await prisma.curriculumStep.findMany({
    orderBy: { order: 'asc' },
  });

  // Create sample clients
  console.log('Creating sample clients...');

  const clients = [
    {
      name: 'Alex Sterling',
      email: 'alex@crypto.com',
      timezone: 'EST',
      coachId: sarahCoach.id,
      status: 'ACTIVE' as const,
      onboardingStatus: 'COMPLETED' as const,
      completedSteps: 4,
      tags: ['Whale', 'High Tech'],
    },
    {
      name: 'Marcus Chen',
      email: 'marcus@ventures.io',
      timezone: 'PST',
      coachId: mikeCoach.id,
      status: 'AT_RISK' as const,
      riskReason: 'Missed 2 consecutive coaching calls',
      onboardingStatus: 'NO_SHOW' as const,
      completedSteps: 0,
      tags: ['Venture Capital', 'Busy'],
    },
    {
      name: 'Elena Rodriguez',
      email: 'elena@defi.net',
      timezone: 'CET',
      coachId: sarahCoach.id,
      status: 'ONBOARDING' as const,
      onboardingStatus: 'BOOKED' as const,
      completedSteps: 1,
      tags: ['Fast Mover'],
    },
    {
      name: 'David Kim',
      email: 'dkim@trading.co',
      timezone: 'KST',
      coachId: mikeCoach.id,
      status: 'ACTIVE' as const,
      onboardingStatus: 'COMPLETED' as const,
      completedSteps: 8,
      tags: ['Trader', 'Technical'],
    },
    {
      name: 'Sarah Connor',
      email: 'sarah@skynet.com',
      timezone: 'PST',
      coachId: sarahCoach.id,
      status: 'AT_RISK' as const,
      riskReason: 'Stalled on Module 2 for >14 days',
      onboardingStatus: 'COMPLETED' as const,
      completedSteps: 2,
      tags: ['Ghosting?'],
    },
  ];

  for (const clientData of clients) {
    const { tags, completedSteps, ...data } = clientData;

    const client = await prisma.client.upsert({
      where: { email: data.email },
      update: {},
      create: {
        ...data,
        lastContactDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
        tags: {
          create: tags.map((name) => ({ name })),
        },
        outcome: {
          create: {
            reviewStatus: Math.random() > 0.7 ? 'DONE' : 'POTENTIAL',
            reviewDone: Math.random() > 0.7,
            endorsementStatus: Math.random() > 0.8 ? 'DONE' : 'POTENTIAL',
            endorsementDone: Math.random() > 0.8,
            innerCircleStatus: Math.random() > 0.9 ? 'DONE' : 'POTENTIAL',
            innerCircleDone: Math.random() > 0.9,
          },
        },
        progress: {
          create: steps.map((step, index) => ({
            stepId: step.id,
            isCompleted: index < completedSteps,
            completedAt: index < completedSteps ? new Date() : null,
          })),
        },
      },
    });

    // Add a sample note for some clients
    if (Math.random() > 0.5) {
      await prisma.note.create({
        data: {
          clientId: client.id,
          authorId: data.coachId,
          content: `Initial coaching session with ${client.name}. Discussed goals and timeline.`,
          tags: JSON.stringify(['Onboarding', 'Goals']),
        },
      });
    }
  }

  console.log('Seed completed!');
  console.log('');
  console.log('Created users:');
  console.log('  Admin: admin@mastermind.com / admin123');
  console.log('  Coach: sarah@mastermind.com / coach123');
  console.log('  Coach: mike@mastermind.com / coach123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
