import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Name pools for generating realistic clients
const FIRST_NAMES = [
  'James', 'Mary', 'Robert', 'Patricia', 'John', 'Jennifer', 'Michael', 'Linda',
  'David', 'Elizabeth', 'William', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica',
  'Thomas', 'Sarah', 'Christopher', 'Karen', 'Charles', 'Lisa', 'Daniel', 'Nancy',
  'Matthew', 'Betty', 'Anthony', 'Margaret', 'Mark', 'Sandra', 'Donald', 'Ashley',
  'Steven', 'Kimberly', 'Paul', 'Emily', 'Andrew', 'Donna', 'Joshua', 'Michelle',
  'Kenneth', 'Dorothy', 'Kevin', 'Carol', 'Brian', 'Amanda', 'George', 'Melissa',
  'Timothy', 'Deborah', 'Ronald', 'Stephanie', 'Edward', 'Rebecca', 'Jason', 'Sharon',
  'Jeffrey', 'Laura', 'Ryan', 'Cynthia', 'Jacob', 'Kathleen', 'Gary', 'Amy',
  'Nicholas', 'Angela', 'Eric', 'Shirley', 'Jonathan', 'Anna', 'Stephen', 'Brenda',
  'Larry', 'Pamela', 'Justin', 'Emma', 'Scott', 'Nicole', 'Brandon', 'Helen',
  'Benjamin', 'Samantha', 'Samuel', 'Katherine', 'Raymond', 'Christine', 'Gregory', 'Debra',
  'Frank', 'Rachel', 'Alexander', 'Carolyn', 'Patrick', 'Janet', 'Jack', 'Catherine',
  'Dennis', 'Maria', 'Jerry', 'Heather', 'Tyler', 'Diane', 'Aaron', 'Ruth',
  'Jose', 'Julie', 'Adam', 'Olivia', 'Nathan', 'Joyce', 'Henry', 'Virginia',
  'Douglas', 'Victoria', 'Zachary', 'Kelly', 'Peter', 'Lauren', 'Kyle', 'Christina',
];

const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas',
  'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White',
  'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker', 'Young',
  'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores',
  'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell',
  'Carter', 'Roberts', 'Gomez', 'Phillips', 'Evans', 'Turner', 'Diaz', 'Parker',
  'Cruz', 'Edwards', 'Collins', 'Reyes', 'Stewart', 'Morris', 'Morales', 'Murphy',
  'Cook', 'Rogers', 'Gutierrez', 'Ortiz', 'Morgan', 'Cooper', 'Peterson', 'Bailey',
  'Reed', 'Kelly', 'Howard', 'Ramos', 'Kim', 'Cox', 'Ward', 'Richardson',
  'Watson', 'Brooks', 'Chavez', 'Wood', 'James', 'Bennett', 'Gray', 'Mendoza',
  'Ruiz', 'Hughes', 'Price', 'Alvarez', 'Castillo', 'Sanders', 'Patel', 'Myers',
  'Long', 'Ross', 'Foster', 'Jimenez', 'Powell', 'Jenkins', 'Perry', 'Russell',
  'Sullivan', 'Bell', 'Coleman', 'Butler', 'Henderson', 'Barnes', 'Gonzales', 'Fisher',
  'Vasquez', 'Simmons', 'Griffin', 'Black', 'Chen', 'Singh', 'Wong', 'Kumar',
];

const EMAIL_DOMAINS = [
  'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com',
  'proton.me', 'fastmail.com', 'hey.com', 'pm.me', 'tutanota.com',
  'crypto.io', 'defi.net', 'web3.co', 'blockchain.dev', 'trading.pro',
  'ventures.io', 'capital.co', 'invest.net', 'finance.pro', 'wealth.io',
];

const TIMEZONES = [
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Phoenix', 'America/Anchorage', 'Pacific/Honolulu', 'America/Toronto',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Amsterdam',
  'Asia/Tokyo', 'Asia/Singapore', 'Asia/Hong_Kong', 'Asia/Dubai',
  'Australia/Sydney', 'Australia/Melbourne', 'Pacific/Auckland', 'Asia/Seoul',
];

const TAGS = [
  'Whale', 'High Net Worth', 'Technical', 'Non-Technical', 'Fast Learner',
  'Needs Support', 'Busy Schedule', 'Retired', 'Entrepreneur', 'Corporate',
  'Day Trader', 'HODLer', 'DeFi Native', 'New to Crypto', 'Experienced',
  'Venture Capital', 'Angel Investor', 'Fund Manager', 'Solo Trader', 'Family Office',
  'Quick Responder', 'Slow Responder', 'Detail Oriented', 'Big Picture', 'Risk Averse',
  'Risk Tolerant', 'Tax Conscious', 'International', 'US Based', 'VIP',
];

const RISK_REASONS = [
  'Missed 2 consecutive coaching calls',
  'No response to messages for 10+ days',
  'Stalled on current module for >14 days',
  'Expressed frustration in last call',
  'Requested refund inquiry',
  'Technical issues preventing progress',
  'Life circumstances affecting availability',
  'Considering pausing membership',
  'Behind schedule on milestones',
  'Low engagement with materials',
];

const NOTE_TEMPLATES = [
  'Had a great coaching session today. {name} is making excellent progress on {topic}.',
  'Discussed {topic} in detail. {name} had some concerns but we addressed them.',
  'Follow-up call scheduled for next week. {name} needs to complete {task} before then.',
  '{name} successfully completed {topic}! Moving on to the next module.',
  'Addressed questions about {topic}. {name} is feeling more confident now.',
  'Quick check-in call. {name} is on track and motivated.',
  '{name} had a breakthrough moment understanding {topic}.',
  'Reviewed {name}\'s portfolio setup. Made some optimization suggestions.',
  'Troubleshooting session - helped {name} resolve issues with {topic}.',
  '{name} shared some wins from applying {topic} strategies.',
  'Goal setting session with {name}. Defined clear milestones for the next month.',
  'Accountability check - {name} completed all assigned tasks.',
  '{name} requested additional resources on {topic}. Sent materials.',
  'Weekly progress review. {name} is ahead of schedule.',
  'Discussed risk management strategies with {name}. Important conversation.',
];

const TOPICS = [
  'wallet security', 'exchange setup', 'DeFi basics', 'yield farming',
  'liquidity provision', 'risk management', 'tax planning', 'portfolio allocation',
  'technical analysis', 'market cycles', 'staking strategies', 'NFT fundamentals',
  'smart contract interaction', 'gas optimization', 'bridge operations', 'L2 solutions',
];

const TASKS = [
  'the security checklist', 'module exercises', 'the practice deployment',
  'portfolio rebalancing', 'the quiz assessment', 'documentation review',
  'the hands-on lab', 'strategy planning worksheet', 'risk assessment form',
];

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomElements<T>(arr: T[], min: number, max: number): T[] {
  const count = Math.floor(Math.random() * (max - min + 1)) + min;
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function generateEmail(firstName: string, lastName: string, index: number): string {
  const domain = randomElement(EMAIL_DOMAINS);
  const formats = [
    `${firstName.toLowerCase()}.${lastName.toLowerCase()}`,
    `${firstName.toLowerCase()}${lastName.toLowerCase()}`,
    `${firstName.toLowerCase()}_${lastName.toLowerCase()}`,
    `${firstName.toLowerCase()[0]}${lastName.toLowerCase()}`,
    `${firstName.toLowerCase()}${lastName.toLowerCase()}${Math.floor(Math.random() * 99)}`,
  ];
  return `${randomElement(formats)}${index}@${domain}`;
}

function generateNote(clientName: string): string {
  let note = randomElement(NOTE_TEMPLATES);
  note = note.replace(/{name}/g, clientName.split(' ')[0]);
  note = note.replace(/{topic}/g, randomElement(TOPICS));
  note = note.replace(/{task}/g, randomElement(TASKS));
  return note;
}

function randomDate(daysAgo: number): Date {
  return new Date(Date.now() - Math.random() * daysAgo * 24 * 60 * 60 * 1000);
}

async function main() {
  console.log('Starting bulk seed of 350 clients...\n');

  // Get existing coaches
  const coaches = await prisma.user.findMany({
    where: { role: 'COACH' },
  });

  if (coaches.length === 0) {
    console.error('No coaches found! Please run the main seed first.');
    process.exit(1);
  }

  console.log(`Found ${coaches.length} coaches: ${coaches.map(c => c.name).join(', ')}`);

  // Get curriculum steps
  const steps = await prisma.curriculumStep.findMany({
    orderBy: { order: 'asc' },
  });

  if (steps.length === 0) {
    console.error('No curriculum steps found! Please run the main seed first.');
    process.exit(1);
  }

  console.log(`Found ${steps.length} curriculum steps`);

  // Track used emails to avoid duplicates
  const usedEmails = new Set<string>();

  // Get existing client emails
  const existingClients = await prisma.client.findMany({ select: { email: true } });
  existingClients.forEach(c => usedEmails.add(c.email));

  console.log(`\nCreating 350 clients with full demo data...\n`);

  const CLIENT_COUNT = 350;
  let created = 0;

  for (let i = 0; i < CLIENT_COUNT; i++) {
    const firstName = randomElement(FIRST_NAMES);
    const lastName = randomElement(LAST_NAMES);
    const name = `${firstName} ${lastName}`;

    // Generate unique email
    let email = generateEmail(firstName, lastName, i);
    let attempts = 0;
    while (usedEmails.has(email) && attempts < 10) {
      email = generateEmail(firstName, lastName, i + Math.floor(Math.random() * 1000));
      attempts++;
    }
    usedEmails.add(email);

    // Assign to random coach
    const coach = randomElement(coaches);

    // Random status distribution (realistic)
    const statusRoll = Math.random();
    let status: string;
    let riskReason: string | null = null;

    if (statusRoll < 0.15) {
      status = 'ONBOARDING';
    } else if (statusRoll < 0.65) {
      status = 'ACTIVE';
    } else if (statusRoll < 0.80) {
      status = 'AT_RISK';
      riskReason = randomElement(RISK_REASONS);
    } else if (statusRoll < 0.92) {
      status = 'COMPLETED';
    } else {
      status = 'PAUSED';
    }

    // Onboarding status based on main status
    let onboardingStatus: string;
    if (status === 'ONBOARDING') {
      const obRoll = Math.random();
      if (obRoll < 0.3) onboardingStatus = 'NOT_BOOKED';
      else if (obRoll < 0.7) onboardingStatus = 'BOOKED';
      else if (obRoll < 0.9) onboardingStatus = 'COMPLETED';
      else onboardingStatus = 'NO_SHOW';
    } else {
      onboardingStatus = Math.random() > 0.1 ? 'COMPLETED' : 'NO_SHOW';
    }

    // Progress based on status
    let completedSteps: number;
    if (status === 'ONBOARDING') {
      completedSteps = Math.floor(Math.random() * 2);
    } else if (status === 'ACTIVE') {
      completedSteps = Math.floor(Math.random() * 7) + 2;
    } else if (status === 'AT_RISK') {
      completedSteps = Math.floor(Math.random() * 5) + 1;
    } else if (status === 'COMPLETED') {
      completedSteps = steps.length;
    } else {
      completedSteps = Math.floor(Math.random() * 6);
    }

    // Tags (1-4 random tags)
    const clientTags = randomElements(TAGS, 1, 4);

    // Dates
    const createdAt = randomDate(180);
    const lastContactDate = status === 'AT_RISK'
      ? randomDate(21) // At risk = older contact
      : randomDate(14);

    const onboardingDateTime = onboardingStatus === 'BOOKED'
      ? new Date(Date.now() + Math.random() * 14 * 24 * 60 * 60 * 1000)
      : onboardingStatus === 'COMPLETED' || onboardingStatus === 'NO_SHOW'
        ? randomDate(60)
        : null;

    // Outcomes based on status
    const reviewDone = status === 'COMPLETED' ? Math.random() > 0.3 : Math.random() > 0.85;
    const endorsementDone = status === 'COMPLETED' ? Math.random() > 0.5 : Math.random() > 0.92;
    const innerCircleDone = status === 'COMPLETED' ? Math.random() > 0.7 : Math.random() > 0.97;

    try {
      const client = await prisma.client.create({
        data: {
          name,
          email,
          timezone: randomElement(TIMEZONES),
          status,
          riskReason,
          onboardingStatus,
          onboardingDateTime,
          lastContactDate,
          createdAt,
          coachId: coach.id,
          tags: {
            create: clientTags.map(tag => ({ name: tag })),
          },
          outcome: {
            create: {
              reviewStatus: reviewDone ? 'DONE' : randomElement(['POTENTIAL', 'NOT_YET', 'MAYBE_LATER', 'IN_PROGRESS']),
              reviewDone,
              endorsementStatus: endorsementDone ? 'DONE' : randomElement(['POTENTIAL', 'NOT_YET', 'MAYBE_LATER', 'IN_PROGRESS']),
              endorsementCount: endorsementDone ? Math.floor(Math.random() * 5) + 1 : 0,
              endorsementDone,
              innerCircleStatus: innerCircleDone ? 'DONE' : randomElement(['POTENTIAL', 'NOT_YET', 'MAYBE_LATER', 'IN_PROGRESS']),
              innerCircleDone,
            },
          },
          progress: {
            create: steps.map((step, index) => ({
              stepId: step.id,
              isCompleted: index < completedSteps,
              completedAt: index < completedSteps ? randomDate(90) : null,
            })),
          },
        },
      });

      // Add notes (1-5 notes per client, more for active clients)
      const noteCount = status === 'ACTIVE'
        ? Math.floor(Math.random() * 4) + 2
        : status === 'COMPLETED'
          ? Math.floor(Math.random() * 5) + 3
          : Math.floor(Math.random() * 3) + 1;

      for (let n = 0; n < noteCount; n++) {
        await prisma.note.create({
          data: {
            clientId: client.id,
            authorId: coach.id,
            content: generateNote(name),
            tags: JSON.stringify(randomElements(['Follow-up', 'Important', 'Action Required', 'Milestone', 'Question', 'Resources', 'Progress', 'Concern'], 0, 3)),
            isPinned: Math.random() > 0.9,
            createdAt: randomDate(120),
          },
        });
      }

      created++;
      if (created % 50 === 0) {
        console.log(`  Created ${created}/${CLIENT_COUNT} clients...`);
      }
    } catch (error: any) {
      if (error.code === 'P2002') {
        // Duplicate email, skip
        console.log(`  Skipping duplicate: ${email}`);
      } else {
        throw error;
      }
    }
  }

  // Print summary
  console.log('\n✓ Bulk seed completed!\n');

  const summary = await prisma.client.groupBy({
    by: ['status'],
    _count: { id: true },
  });

  console.log('Client distribution:');
  summary.forEach(s => {
    console.log(`  ${s.status}: ${s._count.id}`);
  });

  const totalClients = await prisma.client.count();
  const totalNotes = await prisma.note.count();

  console.log(`\nTotal clients: ${totalClients}`);
  console.log(`Total notes: ${totalNotes}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
