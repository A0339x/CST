import React, { useState, useEffect, useMemo } from 'react';
import DOMPurify from 'dompurify';
import { ClientStatus, OnboardingStatus } from '../types';
import { Badge, ClientStatusBadge, OnboardingBadge } from '../components/ui/Badge';
import { Card, CardHeader } from '../components/ui/Card';
import {
  ArrowLeft,
  Clock,
  MapPin,
  Send,
  MoreHorizontal,
  Calendar as CalendarIcon,
  CheckCircle,
  Circle,
  Pencil,
  Loader2,
  AlertCircle,
  RefreshCw,
  Pin
} from 'lucide-react';
import {
  clientsApi,
  notesApi,
  curriculumApi,
  ClientDetail,
  Note,
  CurriculumProgress
} from '../lib/api';

// Configure DOMPurify for note content - allow basic formatting only
const DOMPURIFY_CONFIG: DOMPurify.Config = {
  ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'b', 'i', 'ul', 'ol', 'li'],
  ALLOWED_ATTR: [],
  ALLOW_DATA_ATTR: false,
};

// Secure Note Item component with XSS protection
const NoteItem: React.FC<{ note: Note }> = ({ note }) => {
  // Sanitize content to prevent XSS - defense in depth
  // Even though React escapes text, this protects against future changes
  // that might introduce dangerouslySetInnerHTML or other vulnerabilities
  const sanitizedContent = useMemo(() => {
    // For plain text, sanitize and strip all HTML tags
    return DOMPurify.sanitize(note.content, { ALLOWED_TAGS: [] });
  }, [note.content]);

  return (
    <div className="group relative pl-4 border-l-2 border-slate-700 hover:border-blue-500 transition-colors">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-200 text-sm">{note.author?.name || 'Unknown'}</span>
          {note.isPinned && <Pin className="w-3 h-3 text-yellow-500" />}
        </div>
        <span className="text-xs text-slate-500">{new Date(note.createdAt).toLocaleDateString()}</span>
      </div>
      <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-line">{sanitizedContent}</p>
      {note.tags && note.tags.length > 0 && (
        <div className="flex gap-2 mt-2">
          {note.tags.map(t => (
            <span key={t} className="text-xs text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">{t}</span>
          ))}
        </div>
      )}
    </div>
  );
};

interface ClientProfileProps {
  clientId: string;
  onBack: () => void;
}

// Map API onboarding status to frontend enum
const mapOnboardingStatus = (status: string): OnboardingStatus => {
  switch (status) {
    case 'NOT_BOOKED': return OnboardingStatus.NOT_BOOKED;
    case 'BOOKED': return OnboardingStatus.BOOKED;
    case 'COMPLETED': return OnboardingStatus.COMPLETED;
    case 'NO_SHOW': return OnboardingStatus.NO_SHOW;
    default: return OnboardingStatus.NOT_BOOKED;
  }
};

// Map API status to frontend enum
const mapClientStatus = (status: string): ClientStatus => {
  switch (status) {
    case 'ONBOARDING': return ClientStatus.ONBOARDING;
    case 'ACTIVE': return ClientStatus.ACTIVE;
    case 'AT_RISK': return ClientStatus.AT_RISK;
    case 'COMPLETED': return ClientStatus.COMPLETED;
    case 'PAUSED': return ClientStatus.PAUSED;
    default: return ClientStatus.ACTIVE;
  }
};

export const ClientProfile: React.FC<ClientProfileProps> = ({ clientId, onBack }) => {
  const [activeTab, setActiveTab] = useState<'NOTES' | 'PROGRESS' | 'FIELDS'>('NOTES');
  const [newNote, setNewNote] = useState('');
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);

  // API state
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Race condition prevention: track which steps are being toggled
  const [togglingSteps, setTogglingSteps] = useState<Set<string>>(new Set());

  // Fetch client data with AbortController for cleanup
  useEffect(() => {
    const controller = new AbortController();
    let isMounted = true;

    const fetchClient = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const { client: clientData } = await clientsApi.get(clientId);

        // Only update state if component is still mounted
        if (isMounted) {
          setClient(clientData);
        }
      } catch (err: any) {
        // Ignore abort errors - they're intentional
        if (err.name === 'AbortError') return;

        if (isMounted) {
          setError(err.message || 'Failed to load client');
          console.error('Client load error:', err);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchClient();

    // Cleanup: prevent memory leak and state updates after unmount
    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [clientId]);

  // Manual refresh function
  const loadClient = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const { client: clientData } = await clientsApi.get(clientId);
      setClient(clientData);
    } catch (err: any) {
      setError(err.message || 'Failed to load client');
      console.error('Client load error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateNote = async () => {
    const trimmedNote = newNote.trim();

    // Validate: not empty and reasonable length
    if (!trimmedNote || !client) return;
    if (trimmedNote.length > 10000) {
      alert('Note is too long. Please keep it under 10,000 characters.');
      return;
    }

    try {
      setIsSubmittingNote(true);
      await notesApi.create(clientId, {
        content: trimmedNote,
        tags: [],
      });
      setNewNote('');
      // Reload client to get updated notes
      await loadClient();
    } catch (err: any) {
      console.error('Failed to create note:', err);
      // Don't expose internal error details to user
      alert('Failed to create note. Please try again.');
    } finally {
      setIsSubmittingNote(false);
    }
  };

  // Handle progress toggle with race condition prevention
  const handleToggleProgress = async (stepId: string, isCompleted: boolean) => {
    if (!client) return;

    // Prevent double-clicks: check if this step is already being toggled
    if (togglingSteps.has(stepId)) return;

    // Add step to toggling set
    setTogglingSteps(prev => new Set(prev).add(stepId));

    try {
      await curriculumApi.updateProgress(clientId, stepId, !isCompleted);
      await loadClient();
    } catch (err: any) {
      console.error('Failed to update progress:', err);
      alert('Failed to update progress. Please try again.');
    } finally {
      // Remove step from toggling set
      setTogglingSteps(prev => {
        const next = new Set(prev);
        next.delete(stepId);
        return next;
      });
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        <p className="text-slate-400">Loading client...</p>
      </div>
    );
  }

  // Error state
  if (error || !client) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertCircle className="w-12 h-12 text-rose-500" />
        <p className="text-rose-400">{error || 'Client not found'}</p>
        <div className="flex gap-3">
          <button
            onClick={onBack}
            className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
          >
            Go Back
          </button>
          <button
            onClick={loadClient}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Map status values for display components
  const displayStatus = mapClientStatus(client.status);
  const displayOnboardingStatus = mapOnboardingStatus(client.onboardingStatus);

  // Get outcomes from the client or provide defaults
  const outcomes = client.outcomes || { hasReview: false, hasReferral: false, isInnerCircle: false };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header / Meta */}
      <div className="flex flex-col md:flex-row gap-6 items-start justify-between">
        <div className="flex items-start gap-4">
          <button
            onClick={onBack}
            className="mt-1 p-2 hover:bg-slate-800 rounded-full text-slate-400 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex gap-4">
            <div className="w-16 h-16 rounded-xl bg-slate-700 ring-4 ring-slate-800 flex items-center justify-center text-white text-xl font-bold">
              {client.name.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white mb-1 flex items-center gap-3">
                {client.name}
                <ClientStatusBadge status={displayStatus} />
              </h1>
              <div className="flex flex-wrap items-center gap-4 text-sm text-slate-400">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {client.timezone || 'UTC'}
                </span>
                <span className="flex items-center gap-1">
                  Coach: <span className="text-slate-300">{client.coach?.name || 'Unassigned'}</span>
                </span>
                <span>
                  Last Contact: {client.lastContactDate ? new Date(client.lastContactDate).toLocaleDateString() : 'Never'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
           {/* Outcomes Quick View */}
           <div className="flex gap-2 p-1 bg-slate-800 rounded-lg border border-slate-700">
             <div className={`px-3 py-1 rounded text-xs font-semibold ${outcomes.hasReview ? 'bg-yellow-500/20 text-yellow-500' : 'text-slate-600'}`}>Review</div>
             <div className={`px-3 py-1 rounded text-xs font-semibold ${outcomes.hasReferral ? 'bg-emerald-500/20 text-emerald-500' : 'text-slate-600'}`}>Referral</div>
             <div className={`px-3 py-1 rounded text-xs font-semibold ${outcomes.isInnerCircle ? 'bg-purple-500/20 text-purple-500' : 'text-slate-600'}`}>Inner Circle</div>
           </div>
        </div>
      </div>

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Context & Progress Summary */}
        <div className="space-y-6">
          <Card>
             <CardHeader title="Current Focus" />
             <div className="mb-4">
               <div className="text-xs text-slate-500 mb-1">
                 Curriculum Step {(client.currentStepIndex || 0) + 1} of {client.totalSteps || client.curriculum?.length || 10}
               </div>
               <div className="font-medium text-white text-lg">
                 {client.curriculum?.[client.currentStepIndex || 0]?.title || 'Getting Started'}
               </div>
               <div className="w-full bg-slate-700 rounded-full h-1.5 mt-3">
                  <div
                    className="bg-blue-500 h-1.5 rounded-full"
                    style={{ width: `${((client.currentStepIndex || 0) / (client.totalSteps || client.curriculum?.length || 10)) * 100}%` }}
                  />
               </div>
             </div>
             <div className="flex justify-between items-center py-3 border-t border-slate-700/50">
               <span className="text-sm text-slate-400">Onboarding</span>
               <OnboardingBadge status={displayOnboardingStatus} />
             </div>
          </Card>

          <Card>
            <CardHeader title="Client Tags" />
            <div className="flex flex-wrap gap-2">
              {(client.tags || []).map(tag => (
                <Badge key={tag} variant="neutral">{tag}</Badge>
              ))}
              <button className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 px-2 py-1 rounded border border-dashed border-slate-600">
                + Add
              </button>
            </div>
          </Card>
        </div>

        {/* Right Column: Work Area (Tabs) */}
        <div className="lg:col-span-2">
          <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-sm min-h-[600px] flex flex-col">
            
            {/* Tabs Header */}
            <div className="flex border-b border-slate-700">
              <button 
                onClick={() => setActiveTab('NOTES')}
                className={`flex-1 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'NOTES' ? 'border-blue-500 text-white bg-slate-800' : 'border-transparent text-slate-500 hover:text-slate-300 bg-slate-900/30'}`}
              >
                Notes & Timeline
              </button>
              <button 
                onClick={() => setActiveTab('PROGRESS')}
                className={`flex-1 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'PROGRESS' ? 'border-blue-500 text-white bg-slate-800' : 'border-transparent text-slate-500 hover:text-slate-300 bg-slate-900/30'}`}
              >
                Curriculum Progress
              </button>
              <button 
                onClick={() => setActiveTab('FIELDS')}
                className={`flex-1 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'FIELDS' ? 'border-blue-500 text-white bg-slate-800' : 'border-transparent text-slate-500 hover:text-slate-300 bg-slate-900/30'}`}
              >
                Custom Fields
              </button>
            </div>

            {/* Tab Content */}
            <div className="flex-1 p-0 bg-slate-800">
              
              {/* NOTES TAB */}
              {activeTab === 'NOTES' && (
                <div className="flex flex-col h-full">
                  {/* Quick Add Note - Top of the list for speed */}
                  <div className="p-4 border-b border-slate-700 bg-slate-800/50">
                    <textarea
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none placeholder-slate-500"
                      rows={3}
                      placeholder="Add a new note, call summary, or blocker..."
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      disabled={isSubmittingNote}
                    />
                    <div className="flex justify-between items-center mt-3">
                      <div className="flex gap-2">
                        <button className="text-slate-400 hover:text-white transition-colors p-1.5 rounded hover:bg-slate-700">
                          <CalendarIcon className="w-4 h-4" />
                        </button>
                         <button className="text-slate-400 hover:text-white transition-colors p-1.5 rounded hover:bg-slate-700">
                          <MapPin className="w-4 h-4" />
                        </button>
                      </div>
                      <button
                        onClick={handleCreateNote}
                        disabled={isSubmittingNote || !newNote.trim()}
                        className="bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 disabled:cursor-not-allowed text-white px-4 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2"
                      >
                        {isSubmittingNote ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Posting...
                          </>
                        ) : (
                          <>
                            Post Note <Send className="w-3 h-3" />
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Notes Stream */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    {(!client.notes || client.notes.length === 0) ? (
                      <div className="text-center py-10 text-slate-500">
                        No notes yet. Start tracking interactions.
                      </div>
                    ) : (
                      client.notes.map(note => (
                        <NoteItem key={note.id} note={note} />
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* PROGRESS TAB */}
              {activeTab === 'PROGRESS' && (
                <div className="p-6 overflow-y-auto h-full">
                  <div className="space-y-4 max-w-2xl">
                    {(client.curriculum || []).map((step, idx) => {
                      const currentStepIdx = client.currentStepIndex || 0;
                      const isCurrent = idx === currentStepIdx;
                      const isFuture = idx > currentStepIdx;
                      const isCompleted = step.isCompleted;

                      const isToggling = togglingSteps.has(step.id);

                      return (
                        <div
                          key={step.id}
                          className={`flex items-start gap-4 p-4 rounded-xl border transition-all cursor-pointer hover:bg-slate-700/20 ${
                            isCurrent
                            ? 'bg-blue-500/5 border-blue-500/50 shadow-md shadow-blue-900/10'
                            : 'bg-transparent border-slate-700/30 opacity-80 hover:opacity-100'
                          } ${isToggling ? 'opacity-50 pointer-events-none' : ''}`}
                          onClick={() => handleToggleProgress(step.id, isCompleted)}
                        >
                          <div className="mt-0.5">
                            {isToggling ? (
                              <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                            ) : isCompleted ? (
                              <CheckCircle className="w-6 h-6 text-emerald-500" />
                            ) : isCurrent ? (
                              <div className="w-6 h-6 rounded-full border-2 border-blue-500 flex items-center justify-center">
                                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                              </div>
                            ) : (
                              <Circle className="w-6 h-6 text-slate-600" />
                            )}
                          </div>
                          <div className="flex-1">
                            <h4 className={`text-sm font-medium ${isCompleted || isCurrent ? 'text-white' : 'text-slate-500'}`}>
                              Module {step.order + 1}: {step.title}
                            </h4>
                            {isCurrent && (
                              <p className="text-xs text-blue-400 mt-1">In Progress</p>
                            )}
                            {isCompleted && step.completedAt && (
                              <p className="text-xs text-emerald-400 mt-1">
                                Completed {new Date(step.completedAt).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                          <div className="text-xs text-slate-500">
                            Click to {isCompleted ? 'mark incomplete' : 'mark complete'}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* FIELDS TAB */}
              {activeTab === 'FIELDS' && (
                <div className="p-6">
                  {(!client.customFields || client.customFields.length === 0) ? (
                    <div className="text-center py-10 text-slate-500">
                      <p className="mb-2">No custom fields configured for this client.</p>
                      <p className="text-xs">Custom fields can be added by an administrator.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-x-8 gap-y-6">
                      {client.customFields.map(field => (
                        <div key={field.id} className="group border-b border-slate-700 pb-2">
                           <label className="text-xs uppercase text-slate-500 mb-1 block">{field.name}</label>
                           <div className="flex justify-between items-center">
                             <span className="text-slate-200">{field.value || '-'}</span>
                             <Pencil className="w-3 h-3 text-slate-600 opacity-0 group-hover:opacity-100 cursor-pointer" />
                           </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
