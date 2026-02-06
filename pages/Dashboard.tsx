import React, { useState, useMemo, useEffect } from 'react';
import { ClientStatus, OnboardingStatus } from '../types';
import { ClientStatusBadge, OnboardingBadge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { clientsApi, curriculumApi, Client as ApiClient, CurriculumStep } from '../lib/api';
import {
  AlertTriangle,
  Search,
  ChevronRight,
  Star,
  CheckCircle2,
  AlertCircle,
  LayoutGrid,
  List,
  CalendarClock,
  Ghost,
  Clock,
  PhoneIncoming,
  ArrowUpDown,
  Loader2,
  RefreshCw
} from 'lucide-react';

// Extended client type for Dashboard display
interface DashboardClient {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  coachName: string;
  status: ClientStatus;
  riskReason?: string;
  onboardingStatus: OnboardingStatus;
  currentStepIndex: number;
  totalSteps: number;
  lastContactDate: string;
  timezone: string;
  tags: string[];
  outcomes: {
    hasReview: boolean;
    hasReferral: boolean;
    isInnerCircle: boolean;
  };
  curriculum: Array<{ id: string; order: number; title: string; isCompleted: boolean }>;
  notes: Array<{ id: string; author: string; content: string; timestamp: string; tags: string[] }>;
}

interface DashboardProps {
  onNavigateToClient: (id: string) => void;
}

// -- High Density Visual Component --
const ClientSignalNode: React.FC<{
  client: DashboardClient;
  index: number;
  curriculumSteps: string[];
  onClick: () => void;
}> = ({ client, index, curriculumSteps, onClick }) => {
  const progressPercent = (client.currentStepIndex / client.totalSteps) * 100;
  
  // -- CALCULATE DERIVED STATES --
  
  // 1. Time Calculations
  const now = new Date().getTime();
  const lastContactTime = new Date(client.lastContactDate).getTime();
  const daysSinceContact = Math.floor((now - lastContactTime) / (1000 * 3600 * 24));
  
  // For Onboarding clients, lastContactDate is treated as "Joined Date" or "Last Contact"
  const daysSinceJoined = daysSinceContact; 

  const isGhosting = client.status === ClientStatus.ACTIVE && daysSinceContact > 21;

  // 2. Color & Style Logic
  let strokeColor = '#3b82f6'; // Default Blue
  let isDashed = false;
  let statusLabel = client.status.replace('_', ' ');
  let urgencyColorClass = 'bg-blue-500'; // For dots

  // Onboarding Specifics
  if (client.status === ClientStatus.ONBOARDING) {
    if (client.onboardingStatus === OnboardingStatus.NOT_BOOKED) {
      // -- ESCALATING URGENCY LOGIC --
      if (daysSinceJoined >= 4) {
        strokeColor = '#dc2626'; // Red 600 - CRITICAL
        statusLabel = `CRITICAL: Day ${daysSinceJoined}`;
        urgencyColorClass = 'bg-red-600';
      } else if (daysSinceJoined === 3) {
        strokeColor = '#ea580c'; // Orange 600 - HIGH URGENCY
        statusLabel = `Urgent: Day ${daysSinceJoined}`;
        urgencyColorClass = 'bg-orange-600';
      } else if (daysSinceJoined === 2) {
        strokeColor = '#f97316'; // Orange 500 - MEDIUM URGENCY
        statusLabel = `Warning: Day ${daysSinceJoined}`;
        urgencyColorClass = 'bg-orange-500';
      } else {
        strokeColor = '#f59e0b'; // Amber 500 - LOW URGENCY
        statusLabel = 'Needs Booking';
        urgencyColorClass = 'bg-amber-500';
      }
    } else if (client.onboardingStatus === OnboardingStatus.BOOKED) {
      strokeColor = '#0ea5e9'; // Sky Blue (Scheduled)
      statusLabel = 'Call Booked';
      urgencyColorClass = 'bg-sky-500';
    } else if (client.onboardingStatus === OnboardingStatus.NO_SHOW) {
      strokeColor = '#e11d48'; // Rose 600 (No Show)
      statusLabel = 'No Show';
      urgencyColorClass = 'bg-rose-600';
    } else {
      strokeColor = '#3b82f6'; // Standard Blue
    }
  } 
  // Active / Risk Specifics
  else if (client.status === ClientStatus.AT_RISK) {
    strokeColor = '#f43f5e'; // Rose
    urgencyColorClass = 'bg-rose-500';
  } 
  else if (client.status === ClientStatus.ACTIVE) {
    if (isGhosting) {
      strokeColor = '#a855f7'; // Purple for Ghosting
      isDashed = true;
      statusLabel = 'Ghosting?';
      urgencyColorClass = 'bg-purple-500';
    } else {
      strokeColor = '#10b981'; // Emerald for Healthy
      urgencyColorClass = 'bg-emerald-500';
    }
  } 
  else if (client.status === ClientStatus.COMPLETED) {
    strokeColor = '#64748b'; // Slate
  }

  // Sizing Math for w-16 (64px)
  const size = 60;
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progressPercent / 100) * circumference;
  const center = size / 2;

  // Name Parsing
  const nameParts = client.name.split(' ');
  const firstName = nameParts[0];
  const lastInitial = nameParts.length > 1 ? nameParts[nameParts.length - 1][0] + '.' : '';

  // Mock Onboarding Date (for demo purposes if booked)
  const mockBookedDate = new Date();
  mockBookedDate.setDate(mockBookedDate.getDate() + 2); // 2 days from now

  // Tooltip Positioning Heuristic
  // If index is small (top rows), show tooltip BELOW the node to avoid clipping at the top of screen
  const isTopRow = index < 18; 

  return (
    <div 
      className="group relative flex flex-col items-center justify-center cursor-pointer rounded-full transition-transform hover:scale-105 z-10 hover:z-50"
      onClick={onClick}
    >
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        {/* Progress Ring SVG */}
        <svg className="transform -rotate-90 drop-shadow-md" width={size} height={size}>
          <circle
            cx={center}
            cy={center}
            r={radius}
            stroke="#1e293b" // Slate 800 background track
            strokeWidth={strokeWidth}
            fill="#0f172a" // Fill with dark bg
          />
          <circle
            cx={center}
            cy={center}
            r={radius}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={isDashed ? "4 4" : circumference} 
            strokeDashoffset={isDashed ? 0 : strokeDashoffset} 
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        
        {/* Name Inside Ring */}
        <div className="absolute inset-0 flex flex-col items-center justify-center leading-none pointer-events-none p-1 z-10">
             <span className="text-[10px] font-bold text-white truncate w-full text-center px-1 drop-shadow-md">
               {firstName}
             </span>
             {lastInitial && (
               <span className="text-[10px] font-bold text-slate-300 group-hover:text-white transition-colors mt-0.5 drop-shadow-md">
                 {lastInitial}
               </span>
             )}
        </div>

        {/* Status Indicators (Dots) */}
        
        {/* Red Dot for At Risk or No Show */}
        {(client.status === ClientStatus.AT_RISK || client.onboardingStatus === OnboardingStatus.NO_SHOW) && (
          <div className="absolute top-0 right-0 w-3 h-3 bg-rose-500 border-2 border-slate-900 rounded-full animate-pulse shadow-rose-900/50 shadow-lg z-20" />
        )}

        {/* Dynamic Dot for Not Booked Onboarding (Colors scale with urgency) */}
        {client.status === ClientStatus.ONBOARDING && client.onboardingStatus === OnboardingStatus.NOT_BOOKED && (
          <div className={`absolute top-0 right-0 w-3 h-3 ${urgencyColorClass} border-2 border-slate-900 rounded-full animate-bounce shadow-lg z-20`} />
        )}
      </div>

      {/* Tooltip Hover Card - Positioned intelligently based on row index */}
      <div className={`absolute left-1/2 -translate-x-1/2 w-64 flex flex-col items-center opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 
          ${isTopRow ? 'top-full mt-3' : 'bottom-full mb-3'}
      `}>
         
         {/* Arrow Pointer */}
         <div className={`w-3 h-3 bg-slate-950 border-slate-600 rotate-45 flex-shrink-0 absolute
            ${isTopRow 
               ? '-top-1.5 border-t border-l' // Pointing Up
               : '-bottom-1.5 border-b border-r' // Pointing Down
            }
         `}></div>

         {/* Content Box */}
         <div className="w-full bg-slate-950 border border-slate-600 rounded-lg shadow-2xl relative overflow-hidden z-50">
            <div className={`h-1.5 w-full`} style={{ backgroundColor: strokeColor }} />
            <div className="p-3">
              <div className="flex items-start justify-between mb-2">
                <div>
                   <p className="text-white font-semibold text-sm leading-tight">{client.name}</p>
                   <p className="text-xs text-slate-400">{client.coachName}</p>
                </div>
                {client.outcomes.hasReview && <Star className="w-3 h-3 text-yellow-500" fill="currentColor" />}
              </div>
              
              <div className="space-y-3">
                {/* Status Row */}
                <div className="flex items-center justify-between text-xs bg-slate-900 p-1.5 rounded border border-slate-800">
                  <span className="text-slate-400">Status</span>
                  <span className="font-bold" style={{ color: strokeColor }}>
                    {statusLabel.toUpperCase()}
                  </span>
                </div>

                {/* Risk Reason Display */}
                {client.status === ClientStatus.AT_RISK && client.riskReason && (
                   <div className="flex items-start gap-2 text-xs text-rose-300 bg-rose-950/60 p-2 rounded border border-rose-500/30">
                     <AlertTriangle className="w-3.5 h-3.5 mt-0.5 text-rose-500" />
                     <div>
                       <span className="block font-bold text-rose-400">Risk Factor</span>
                       <span className="opacity-90">{client.riskReason}</span>
                     </div>
                   </div>
                )}

                {/* Special Conditions Messages */}
                {client.onboardingStatus === OnboardingStatus.BOOKED && (
                  <div className="flex items-start gap-2 text-xs text-sky-400 bg-sky-950/50 p-2 rounded border border-sky-500/20">
                    <CalendarClock className="w-3.5 h-3.5 mt-0.5" />
                    <div>
                      <span className="block font-semibold">Onboarding Call</span>
                      <span className="opacity-80">{mockBookedDate.toLocaleDateString()} at 2:00 PM</span>
                    </div>
                  </div>
                )}

                {/* Escalating Urgency Message */}
                {client.status === ClientStatus.ONBOARDING && client.onboardingStatus === OnboardingStatus.NOT_BOOKED && (
                  <div className={`flex items-start gap-2 text-xs p-2 rounded border ${
                     daysSinceJoined >= 4 ? 'text-rose-400 bg-rose-950/50 border-rose-500/20' :
                     daysSinceJoined >= 2 ? 'text-orange-400 bg-orange-950/50 border-orange-500/20' :
                     'text-amber-400 bg-amber-950/50 border-amber-500/20'
                   }`}>
                    <Clock className="w-3.5 h-3.5 mt-0.5" />
                    <div>
                      <span className="block font-semibold">Joined {daysSinceJoined === 0 ? 'Today' : `${daysSinceJoined} days ago`}</span>
                      <span className="opacity-80">
                        {daysSinceJoined >= 4 ? 'Critical: Book Immediately.' :
                         daysSinceJoined >= 2 ? 'Urgent: Needs Booking.' :
                         'Awaiting Booking.'}
                      </span>
                    </div>
                  </div>
                )}

                {isGhosting && (
                  <div className="flex items-start gap-2 text-xs text-purple-400 bg-purple-950/50 p-2 rounded border border-purple-500/20">
                    <Ghost className="w-3.5 h-3.5 mt-0.5" />
                    <div>
                      <span className="block font-semibold">Ghosting Alert</span>
                      <span className="opacity-80">No contact for {daysSinceContact} days</span>
                    </div>
                  </div>
                )}

                {/* Last Contact Info - Show for everyone EXCEPT those waiting to book onboarding (who see the 'Joined X days ago' alert instead) */}
                {!(client.status === ClientStatus.ONBOARDING && client.onboardingStatus === OnboardingStatus.NOT_BOOKED) && (
                   <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800/50">
                     <span className="text-slate-500 flex items-center gap-1.5">
                       <PhoneIncoming className="w-3 h-3" />
                       Last Contact
                     </span>
                     <span className="text-slate-300 font-mono">
                        {/* TODO for Claude Code: This 'Last Contact' date should be sourced from the Go High Level calendar API, representing the timestamp of the last booked call. */}
                        {new Date(client.lastContactDate).toLocaleDateString()}
                     </span>
                   </div>
                )}
                
                <div className="space-y-1">
                   <div className="flex justify-between text-[10px] text-slate-500 uppercase tracking-wider">
                     <span>Progress</span>
                     <span>{Math.round(progressPercent)}%</span>
                   </div>
                   <div className="w-full bg-slate-800 rounded-full h-1">
                     <div className="h-1 rounded-full" style={{ width: `${progressPercent}%`, backgroundColor: strokeColor }} />
                   </div>
                   <div className="text-[10px] text-slate-400 truncate">
                     {curriculumSteps[client.currentStepIndex] || 'Unknown Step'}
                   </div>
                </div>
              </div>
            </div>
         </div>
      </div>
    </div>
  );
};


// Map API client to Dashboard client format
function mapApiClientToDashboard(client: ApiClient, curriculumSteps: CurriculumStep[]): DashboardClient {
  // Map onboarding status from API format to frontend enum
  const mapOnboardingStatus = (status: string): OnboardingStatus => {
    switch (status) {
      case 'NOT_BOOKED': return OnboardingStatus.NOT_BOOKED;
      case 'BOOKED': return OnboardingStatus.BOOKED;
      case 'COMPLETED': return OnboardingStatus.COMPLETED;
      case 'NO_SHOW': return OnboardingStatus.NO_SHOW;
      default: return OnboardingStatus.NOT_BOOKED;
    }
  };

  // Map status from API format to frontend enum
  const mapStatus = (status: string): ClientStatus => {
    switch (status) {
      case 'ONBOARDING': return ClientStatus.ONBOARDING;
      case 'ACTIVE': return ClientStatus.ACTIVE;
      case 'AT_RISK': return ClientStatus.AT_RISK;
      case 'COMPLETED': return ClientStatus.COMPLETED;
      case 'PAUSED': return ClientStatus.PAUSED;
      default: return ClientStatus.ACTIVE;
    }
  };

  return {
    id: client.id,
    name: client.name,
    email: client.email,
    avatarUrl: '',
    coachName: client.coach?.name || 'Unassigned',
    status: mapStatus(client.status),
    riskReason: client.riskReason || undefined,
    onboardingStatus: mapOnboardingStatus(client.onboardingStatus),
    currentStepIndex: client.currentStepIndex || 0,
    totalSteps: client.totalSteps || curriculumSteps.length || 10,
    lastContactDate: client.lastContactDate || client.createdAt,
    timezone: client.timezone || 'UTC',
    tags: client.tags || [],
    outcomes: client.outcomes || { hasReview: false, hasReferral: false, isInnerCircle: false },
    curriculum: curriculumSteps.map((step, idx) => ({
      id: step.id,
      order: step.order,
      title: step.title,
      isCompleted: idx < (client.currentStepIndex || 0),
    })),
    notes: [],
  };
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigateToClient }) => {
  const [viewMode, setViewMode] = useState<'GRID' | 'LIST'>('GRID');
  const [filter, setFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState<string>('PRIORITY');
  const [searchTerm, setSearchTerm] = useState('');

  // API state
  const [clients, setClients] = useState<DashboardClient[]>([]);
  const [curriculumSteps, setCurriculumSteps] = useState<CurriculumStep[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch data on mount
  // Fetch data with AbortController for cleanup
  useEffect(() => {
    const controller = new AbortController();
    let isMounted = true;

    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch clients and curriculum in parallel
        const [clientsResponse, curriculumResponse] = await Promise.all([
          clientsApi.list({ limit: 500 }),
          curriculumApi.list(),
        ]);

        // Only update state if component is still mounted
        if (isMounted) {
          setCurriculumSteps(curriculumResponse.steps);

          // Map API clients to dashboard format
          const mappedClients = clientsResponse.clients.map((c) =>
            mapApiClientToDashboard(c, curriculumResponse.steps)
          );
          setClients(mappedClients);
        }
      } catch (err: any) {
        // Ignore abort errors - they're intentional
        if (err.name === 'AbortError') return;

        if (isMounted) {
          setError(err.message || 'Failed to load data');
          console.error('Dashboard load error:', err);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchData();

    // Cleanup: prevent memory leak and state updates after unmount
    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  // Manual refresh function
  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [clientsResponse, curriculumResponse] = await Promise.all([
        clientsApi.list({ limit: 500 }),
        curriculumApi.list(),
      ]);

      setCurriculumSteps(curriculumResponse.steps);

      const mappedClients = clientsResponse.clients.map((c) =>
        mapApiClientToDashboard(c, curriculumResponse.steps)
      );
      setClients(mappedClients);
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
      console.error('Dashboard load error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Computed Stats
  const atRiskCount = clients.filter(c => c.status === ClientStatus.AT_RISK).length;

  // Revised: "Onboarding Lag" now focuses on No Shows or unbooked
  const onboardingActionCount = clients.filter(c =>
    c.status === ClientStatus.ONBOARDING &&
    (c.onboardingStatus === OnboardingStatus.NO_SHOW || c.onboardingStatus === OnboardingStatus.NOT_BOOKED)
  ).length;

  const activeCount = clients.filter(c => c.status === ClientStatus.ACTIVE).length;

  // -- PRIORITY SCORING HELPER --
  // Lower score = Higher Priority in default sort
  const getPriorityScore = (c: DashboardClient) => {
    // 1. No Show Onboarding are critical errors
    if (c.onboardingStatus === OnboardingStatus.NO_SHOW) return 0;

    // 2. At Risk clients need saving
    if (c.status === ClientStatus.AT_RISK) return 1;

    // 3. Unbooked Onboarding (escalates by days waiting)
    if (c.status === ClientStatus.ONBOARDING && c.onboardingStatus === OnboardingStatus.NOT_BOOKED) {
       const days = Math.floor((new Date().getTime() - new Date(c.lastContactDate).getTime()) / (1000 * 3600 * 24));
       if (days >= 4) return 1.1; // Critical
       if (days >= 2) return 1.5; // Urgent
       return 2; // Normal
    }

    if (c.onboardingStatus === OnboardingStatus.BOOKED) return 3;
    if (c.status === ClientStatus.ACTIVE) return 4;
    return 5;
  };

  const filteredClients = useMemo(() => {
    let result = clients.filter(client => {
      const matchesSearch = client.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilter = filter === 'ALL' ||
        (filter === 'AT_RISK' && client.status === ClientStatus.AT_RISK) ||
        (filter === 'ONBOARDING' && client.status === ClientStatus.ONBOARDING);
      return matchesSearch && matchesFilter;
    });

    // Apply Sorting
    result.sort((a, b) => {
      switch (sortBy) {
        case 'NEEDS_ONBOARDING':
            // 1. Prioritize Clients who are Onboarding AND Not Booked
            const aNeed = a.status === ClientStatus.ONBOARDING && a.onboardingStatus === OnboardingStatus.NOT_BOOKED;
            const bNeed = b.status === ClientStatus.ONBOARDING && b.onboardingStatus === OnboardingStatus.NOT_BOOKED;

            if (aNeed && !bNeed) return -1;
            if (!aNeed && bNeed) return 1;

            // If both need onboarding, sort by urgency (days waiting) via Priority Score
            // If neither, fallback to priority score
            return getPriorityScore(a) - getPriorityScore(b);

        case 'PRIORITY':
            return getPriorityScore(a) - getPriorityScore(b);

        case 'LAST_CONTACT_OLDEST':
            return new Date(a.lastContactDate).getTime() - new Date(b.lastContactDate).getTime();

        case 'LAST_CONTACT_NEWEST':
            return new Date(b.lastContactDate).getTime() - new Date(a.lastContactDate).getTime();

        case 'PROGRESS_LOW':
            return a.currentStepIndex - b.currentStepIndex;

        case 'PROGRESS_HIGH':
            return b.currentStepIndex - a.currentStepIndex;

        case 'NAME':
            return a.name.localeCompare(b.name);

        default:
            return 0;
      }
    });

    return result;
  }, [clients, filter, searchTerm, sortBy]);

  // Get curriculum step titles for display
  const curriculumStepTitles = curriculumSteps.map(s => s.title);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        <p className="text-slate-400">Loading clients...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertCircle className="w-12 h-12 text-rose-500" />
        <p className="text-rose-400">{error}</p>
        <button
          onClick={loadData}
          className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Refresh */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <button
          onClick={loadData}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Alert Panel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-rose-500 bg-gradient-to-r from-rose-500/5 to-slate-800 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-rose-400 font-medium text-xs uppercase tracking-wider">At Risk</p>
              <div className="flex items-baseline gap-2">
                 <h3 className="text-2xl font-bold text-white">{atRiskCount}</h3>
                 <span className="text-xs text-rose-300/60">require attention</span>
              </div>
            </div>
            <AlertTriangle className="text-rose-500/50 w-8 h-8" />
          </div>
        </Card>

        <Card className="border-l-4 border-l-amber-500 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-amber-400 font-medium text-xs uppercase tracking-wider">Onboarding Issues</p>
              <div className="flex items-baseline gap-2">
                 <h3 className="text-2xl font-bold text-white">{onboardingActionCount}</h3>
                 <span className="text-xs text-slate-500">no-show / not booked</span>
              </div>
            </div>
            <AlertCircle className="text-amber-500/50 w-8 h-8" />
          </div>
        </Card>

        <Card className="border-l-4 border-l-emerald-500 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-emerald-400 font-medium text-xs uppercase tracking-wider">Active Cohort</p>
              <div className="flex items-baseline gap-2">
                 <h3 className="text-2xl font-bold text-white">{activeCount}</h3>
                 <span className="text-xs text-slate-500">tracking well</span>
              </div>
            </div>
            <CheckCircle2 className="text-emerald-500/50 w-8 h-8" />
          </div>
        </Card>
      </div>

      {/* Main Control Area */}
      <Card noPadding className="min-h-[500px] flex flex-col shadow-2xl border-slate-800 overflow-visible">
        
        {/* Filters Toolbar */}
        <div className="p-4 border-b border-slate-700 flex flex-col xl:flex-row gap-4 justify-between items-center bg-slate-800/95 backdrop-blur-md sticky top-0 z-10 shadow-md rounded-t-xl">
          <div className="flex items-center gap-2 w-full xl:w-auto overflow-x-auto no-scrollbar">
            <button 
              onClick={() => setFilter('ALL')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${filter === 'ALL' ? 'bg-slate-600 text-white shadow-inner' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}
            >
              All
            </button>
            <button 
              onClick={() => setFilter('AT_RISK')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${filter === 'AT_RISK' ? 'bg-rose-900/40 text-rose-300 border border-rose-500/20 shadow-inner' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}
            >
              At Risk ({atRiskCount})
            </button>
            <button 
              onClick={() => setFilter('ONBOARDING')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${filter === 'ONBOARDING' ? 'bg-blue-900/40 text-blue-300 border border-blue-500/20 shadow-inner' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}
            >
              Onboarding
            </button>
          </div>

          <div className="flex items-center gap-3 w-full xl:w-auto">
             {/* Sort Dropdown */}
            <div className="relative group min-w-[180px]">
               <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 group-hover:text-blue-400 transition-colors z-10" />
               <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full appearance-none bg-slate-900 border border-slate-700 rounded-md pl-9 pr-8 py-1.5 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer hover:border-slate-600 transition-colors"
               >
                  <option value="PRIORITY">Smart Priority</option>
                  <option value="NEEDS_ONBOARDING">Needs Onboarding Call</option>
                  <option value="LAST_CONTACT_OLDEST">Last Contact (Oldest)</option>
                  <option value="LAST_CONTACT_NEWEST">Last Contact (Newest)</option>
                  <option value="PROGRESS_LOW">Progress (Start)</option>
                  <option value="PROGRESS_HIGH">Progress (End)</option>
                  <option value="NAME">Name (A-Z)</option>
               </select>
               <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                 <svg className="w-2 h-2 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
               </div>
            </div>

            <div className="relative flex-1 xl:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input 
                type="text" 
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-md pl-9 pr-4 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-slate-600"
              />
            </div>
            
            <div className="flex bg-slate-900 rounded-md p-0.5 border border-slate-700">
              <button 
                onClick={() => setViewMode('GRID')}
                className={`p-1.5 rounded ${viewMode === 'GRID' ? 'bg-slate-700 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setViewMode('LIST')}
                className={`p-1.5 rounded ${viewMode === 'LIST' ? 'bg-slate-700 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 bg-slate-900/30 p-4">
          
          {filteredClients.length === 0 && (
            <div className="h-64 flex flex-col items-center justify-center text-slate-500">
              <Search className="w-12 h-12 mb-4 opacity-20" />
              <p>No clients found matching criteria</p>
            </div>
          )}

          {viewMode === 'GRID' ? (
             <div className="grid grid-cols-[repeat(auto-fill,minmax(70px,1fr))] gap-3 pb-20">
               {filteredClients.map((client, idx) => (
                 <ClientSignalNode
                    key={client.id}
                    client={client}
                    index={idx}
                    curriculumSteps={curriculumStepTitles}
                    onClick={() => onNavigateToClient(client.id)}
                 />
               ))}
             </div>
          ) : (
             <table className="w-full text-left text-sm text-slate-400">
             <thead className="bg-slate-900/50 text-xs uppercase font-semibold text-slate-500 sticky top-[60px] z-10 backdrop-blur-md">
               <tr>
                 <th className="px-6 py-4">Client</th>
                 <th className="px-6 py-4">Status</th>
                 <th className="px-6 py-4">Progress</th>
                 <th className="px-6 py-4">Last Contact</th>
                 <th className="px-6 py-4"></th>
               </tr>
             </thead>
             <tbody className="divide-y divide-slate-700/50">
               {filteredClients.map((client) => (
                 <tr 
                   key={client.id} 
                   onClick={() => onNavigateToClient(client.id)}
                   className="hover:bg-slate-700/30 cursor-pointer transition-colors group"
                 >
                   <td className="px-6 py-3">
                     <div className="flex items-center gap-3">
                       <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-400 border border-slate-700">
                          {client.name.substring(0,2).toUpperCase()}
                       </div>
                       <span className="font-medium text-slate-200">{client.name}</span>
                     </div>
                   </td>
                   <td className="px-6 py-3">
                      <ClientStatusBadge status={client.status} />
                   </td>
                   <td className="px-6 py-3">
                     <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-slate-700 rounded-full w-24">
                          <div 
                            className="h-1.5 rounded-full bg-blue-500" 
                            style={{ width: `${(client.currentStepIndex / client.totalSteps) * 100}%` }} 
                          />
                        </div>
                        <span className="text-xs">{client.currentStepIndex}/{client.totalSteps}</span>
                     </div>
                   </td>
                   <td className="px-6 py-3">
                     {new Date(client.lastContactDate).toLocaleDateString()}
                   </td>
                   <td className="px-6 py-3 text-right">
                     <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-white" />
                   </td>
                 </tr>
               ))}
             </tbody>
           </table>
          )}
        </div>
        
        {/* Footer Stats */}
        <div className="border-t border-slate-700 p-3 bg-slate-800 text-xs text-slate-500 flex justify-between items-center sticky bottom-0 z-10 rounded-b-xl">
           <span>Showing {filteredClients.length} clients</span>
           <div className="flex gap-4">
              <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-500"></div> Need Booking</span>
              <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-rose-500"></div> No Show</span>
              <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-purple-500"></div> Ghosting</span>
           </div>
        </div>
      </Card>
    </div>
  );
};
