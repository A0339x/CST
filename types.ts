export enum ClientStatus {
  ONBOARDING = 'ONBOARDING',
  ACTIVE = 'ACTIVE',
  AT_RISK = 'AT_RISK',
  COMPLETED = 'COMPLETED',
  PAUSED = 'PAUSED'
}

export enum OnboardingStatus {
  NOT_BOOKED = 'NOT_BOOKED',
  BOOKED = 'BOOKED',
  COMPLETED = 'COMPLETED',
  NO_SHOW = 'NO_SHOW'
}

// Legacy mappings for backward compatibility
export const OnboardingStatusLegacy = {
  NOT_STARTED: 'NOT_BOOKED',
  OVERDUE: 'NO_SHOW',
} as const;

export interface Note {
  id: string;
  author: string;
  content: string;
  timestamp: string;
  tags: string[];
  isPinned?: boolean;
}

export interface CurriculumStep {
  id: string;
  order: number;
  title: string;
  isCompleted: boolean;
  completedAt?: string;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  coachName: string;
  status: ClientStatus;
  riskReason?: string; // Reason why client is AT_RISK
  onboardingStatus: OnboardingStatus;
  currentStepIndex: number; // 0 to 100
  totalSteps: number;
  lastContactDate: string;
  nextActionDate?: string;
  timezone: string;
  tags: string[];
  notes: Note[];
  curriculum: CurriculumStep[];
  outcomes: {
    hasReview: boolean;
    hasReferral: boolean;
    isInnerCircle: boolean;
  };
}

export interface StatMetric {
  label: string;
  value: number;
  trend?: 'up' | 'down' | 'neutral';
  color: 'emerald' | 'rose' | 'amber' | 'blue';
}

// Navigation Context Types
export type ViewState = 'LOGIN' | 'DASHBOARD' | 'CLIENT_PROFILE' | 'CURRICULUM' | 'SETTINGS' | 'ADMIN_USERS';

export interface NavigationContextType {
  currentView: ViewState;
  selectedClientId: string | null;
  navigateTo: (view: ViewState, clientId?: string) => void;
  user: { name: string; avatar: string } | null;
  login: () => void;
  logout: () => void;
}