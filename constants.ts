import { Client, ClientStatus, OnboardingStatus } from './types';

export const MOCK_CURRICULUM_STEPS = [
  "Welcome & Vision Setting",
  "Wallet Security Fundamentals",
  "Exchange Setup & KYC",
  "Liquidity Strategy 101",
  "First Deployment",
  "Advanced Yield Farming",
  "Risk Management",
  "Tax & Compliance",
  "Scaling Operations",
  "Mastermind Graduation"
];

const INITIAL_CLIENTS: Client[] = [
  {
    id: '1',
    name: 'Alex Sterling',
    email: 'alex@crypto.com',
    avatarUrl: '',
    coachName: 'Sarah Jenkins',
    status: ClientStatus.ACTIVE,
    onboardingStatus: OnboardingStatus.COMPLETED,
    currentStepIndex: 4,
    totalSteps: 10,
    lastContactDate: '2023-10-24T10:00:00Z',
    timezone: 'EST',
    tags: ['Whale', 'High Tech'],
    outcomes: { hasReview: false, hasReferral: true, isInnerCircle: false },
    notes: [
      { id: 'n1', author: 'Sarah Jenkins', content: 'Alex is struggling with the impermanent loss concept. Scheduled a 1:1 for Friday.', timestamp: '2023-10-24T10:00:00Z', tags: ['Blocker'] }
    ],
    curriculum: MOCK_CURRICULUM_STEPS.map((t, i) => ({ id: `s-${i}`, order: i, title: t, isCompleted: i < 4 }))
  },
  {
    id: '2',
    name: 'Marcus Chen',
    email: 'marcus@ventures.io',
    avatarUrl: '',
    coachName: 'Mike Ross',
    status: ClientStatus.AT_RISK,
    riskReason: 'Missed 2 consecutive coaching calls',
    onboardingStatus: OnboardingStatus.OVERDUE,
    currentStepIndex: 0,
    totalSteps: 10,
    lastContactDate: '2023-10-15T14:00:00Z', // 10 days ago
    timezone: 'PST',
    tags: ['Venture Capital', 'Busy'],
    outcomes: { hasReview: false, hasReferral: false, isInnerCircle: false },
    notes: [],
    curriculum: MOCK_CURRICULUM_STEPS.map((t, i) => ({ id: `s-${i}`, order: i, title: t, isCompleted: false }))
  },
  {
    id: '3',
    name: 'Elena Rodriguez',
    email: 'elena@defi.net',
    avatarUrl: '',
    coachName: 'Sarah Jenkins',
    status: ClientStatus.ONBOARDING,
    onboardingStatus: OnboardingStatus.BOOKED,
    currentStepIndex: 1,
    totalSteps: 10,
    lastContactDate: '2023-10-25T09:30:00Z',
    timezone: 'CET',
    tags: ['Fast Mover'],
    outcomes: { hasReview: true, hasReferral: false, isInnerCircle: true },
    notes: [
      { id: 'n2', author: 'Sarah Jenkins', content: 'Elena crushed the security setup. Moving her to fast track.', timestamp: '2023-10-25T09:30:00Z', tags: ['Win'] }
    ],
    curriculum: MOCK_CURRICULUM_STEPS.map((t, i) => ({ id: `s-${i}`, order: i, title: t, isCompleted: i < 1 }))
  },
  {
    id: '4',
    name: 'David Kim',
    email: 'dkim@trading.co',
    avatarUrl: '',
    coachName: 'Mike Ross',
    status: ClientStatus.ACTIVE,
    onboardingStatus: OnboardingStatus.COMPLETED,
    currentStepIndex: 8,
    totalSteps: 10,
    lastContactDate: '2023-10-23T16:00:00Z',
    timezone: 'KST',
    tags: ['Trader', 'Technical'],
    outcomes: { hasReview: true, hasReferral: true, isInnerCircle: true },
    notes: [],
    curriculum: MOCK_CURRICULUM_STEPS.map((t, i) => ({ id: `s-${i}`, order: i, title: t, isCompleted: i < 8 }))
  },
  {
    id: '5',
    name: 'Sarah Connor',
    email: 'sarah@skynet.com',
    avatarUrl: '',
    coachName: 'Sarah Jenkins',
    status: ClientStatus.AT_RISK,
    riskReason: 'Stalled on Module 2 for >14 days',
    onboardingStatus: OnboardingStatus.COMPLETED,
    currentStepIndex: 2,
    totalSteps: 10,
    lastContactDate: '2023-10-01T10:00:00Z', // Long time ago
    timezone: 'PST',
    tags: ['Ghosting?'],
    outcomes: { hasReview: false, hasReferral: false, isInnerCircle: false },
    notes: [
      { id: 'n3', author: 'Sarah Jenkins', content: 'Sent follow up email regarding exchange setup.', timestamp: '2023-10-10T10:00:00Z', tags: ['Outreach'] }
    ],
    curriculum: MOCK_CURRICULUM_STEPS.map((t, i) => ({ id: `s-${i}`, order: i, title: t, isCompleted: i < 2 }))
  }
];

// GENERATOR LOGIC
const generateClients = (count: number): Client[] => {
  const generated: Client[] = [];
  const firstNames = ["James", "Mary", "Robert", "Patricia", "John", "Jennifer", "Michael", "Linda", "David", "Elizabeth", "William", "Barbara", "Richard", "Susan", "Joseph", "Jessica", "Thomas", "Sarah", "Charles", "Karen"];
  const lastNames = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore"];
  const coaches = ["Sarah Jenkins", "Mike Ross", "Harvey Specter", "Jessica Pearson"];
  
  const statuses = [
    ClientStatus.ACTIVE, ClientStatus.ACTIVE, ClientStatus.ACTIVE, ClientStatus.ACTIVE, // Heavy weight on Active
    ClientStatus.ONBOARDING, ClientStatus.ONBOARDING, 
    ClientStatus.AT_RISK, 
    ClientStatus.COMPLETED
  ];
  
  const riskReasons = [
    "Stalled Progress (>10 days)", 
    "Missed Check-ins", 
    "Payment Failed", 
    "Declining Engagement", 
    "Technical Blockers",
    "Requested Refund Info"
  ];

  for (let i = 0; i < count; i++) {
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const totalSteps = 10;
    // Randomize step based on status logic
    let currentStepIndex = Math.floor(Math.random() * totalSteps);
    if (status === ClientStatus.ONBOARDING) currentStepIndex = 0;
    if (status === ClientStatus.COMPLETED) currentStepIndex = 10;
    
    // Random onboarding status
    let obStatus = OnboardingStatus.COMPLETED;
    if (status === ClientStatus.ONBOARDING) {
        obStatus = Math.random() > 0.7 ? OnboardingStatus.BOOKED : OnboardingStatus.NOT_STARTED;
    }
    if (status === ClientStatus.AT_RISK) {
        obStatus = Math.random() > 0.5 ? OnboardingStatus.OVERDUE : OnboardingStatus.COMPLETED;
    }

    // Assign risk reason if at risk
    let riskReason = undefined;
    if (status === ClientStatus.AT_RISK) {
      riskReason = riskReasons[Math.floor(Math.random() * riskReasons.length)];
    }

    const hasReview = Math.random() > 0.8;
    const hasReferral = Math.random() > 0.9;
    
    generated.push({
      id: `gen-${i}`,
      name: `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`,
      email: `user${i}@example.com`,
      avatarUrl: '', // No photos as requested
      coachName: coaches[Math.floor(Math.random() * coaches.length)],
      status: status,
      riskReason: riskReason,
      onboardingStatus: obStatus,
      currentStepIndex: currentStepIndex,
      totalSteps: totalSteps,
      lastContactDate: new Date(Date.now() - Math.floor(Math.random() * 1000000000)).toISOString(),
      timezone: ['EST', 'PST', 'GMT', 'CET'][Math.floor(Math.random() * 4)],
      tags: [],
      notes: [],
      outcomes: { hasReview, hasReferral, isInnerCircle: hasReview && hasReferral },
      curriculum: MOCK_CURRICULUM_STEPS.map((t, idx) => ({ 
        id: `s-${idx}`, 
        order: idx, 
        title: t, 
        isCompleted: idx < currentStepIndex 
      }))
    });
  }
  return generated;
};

// Combine manual + generated
export const MOCK_CLIENTS: Client[] = [...INITIAL_CLIENTS, ...generateClients(305)];

export const CURRENT_USER = {
  name: 'Sarah Jenkins',
  avatar: 'https://i.pravatar.cc/150?u=999',
  role: 'Head Coach'
};