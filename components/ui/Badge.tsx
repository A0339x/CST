import React from 'react';
import { ClientStatus, OnboardingStatus } from '../../types';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'purple';
  className?: string;
  size?: 'sm' | 'md';
}

const VARIANTS = {
  neutral: 'bg-slate-800 text-slate-400 border border-slate-700',
  success: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  warning: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  danger: 'bg-rose-500/10 text-rose-400 border border-rose-500/20',
  info: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  purple: 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
};

const SIZES = {
  sm: 'px-2 py-0.5 text-xs font-medium',
  md: 'px-2.5 py-1 text-sm font-medium'
};

export const Badge: React.FC<BadgeProps> = ({ 
  children, 
  variant = 'neutral', 
  size = 'sm',
  className = '' 
}) => {
  return (
    <span className={`inline-flex items-center justify-center rounded-full ${VARIANTS[variant]} ${SIZES[size]} ${className}`}>
      {children}
    </span>
  );
};

// Helper for Client Status
export const ClientStatusBadge: React.FC<{ status: ClientStatus }> = ({ status }) => {
  switch (status) {
    case ClientStatus.ACTIVE:
      return <Badge variant="success">Active</Badge>;
    case ClientStatus.AT_RISK:
      return <Badge variant="danger" className="animate-pulse">At Risk</Badge>;
    case ClientStatus.ONBOARDING:
      return <Badge variant="info">Onboarding</Badge>;
    case ClientStatus.COMPLETED:
      return <Badge variant="purple">Alumni</Badge>;
    case ClientStatus.PAUSED:
      return <Badge variant="neutral">Paused</Badge>;
    default:
      return <Badge>{status}</Badge>;
  }
};

// Helper for Onboarding Status
export const OnboardingBadge: React.FC<{ status: OnboardingStatus }> = ({ status }) => {
  switch (status) {
    case OnboardingStatus.COMPLETED:
      return <Badge variant="success">Onboarded</Badge>;
    case OnboardingStatus.OVERDUE:
      return <Badge variant="danger">Overdue</Badge>;
    case OnboardingStatus.BOOKED:
      return <Badge variant="info">Booked</Badge>;
    case OnboardingStatus.NOT_STARTED:
      return <Badge variant="warning">Not Started</Badge>;
    default:
      return <Badge>{status}</Badge>;
  }
};
