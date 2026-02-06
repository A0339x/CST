import React, { useState } from 'react';
import { Client, ClientStatus } from '../types';
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
  Pencil
} from 'lucide-react';
import { MOCK_CLIENTS } from '../constants'; // In real app, fetch by ID

interface ClientProfileProps {
  clientId: string;
  onBack: () => void;
}

export const ClientProfile: React.FC<ClientProfileProps> = ({ clientId, onBack }) => {
  const [activeTab, setActiveTab] = useState<'NOTES' | 'PROGRESS' | 'FIELDS'>('NOTES');
  const [newNote, setNewNote] = useState('');
  
  // Mock fetching client
  const client = MOCK_CLIENTS.find(c => c.id === clientId);

  if (!client) return <div>Client not found</div>;

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
            <img 
              src={client.avatarUrl} 
              alt={client.name} 
              className="w-16 h-16 rounded-xl object-cover bg-slate-700 ring-4 ring-slate-800"
            />
            <div>
              <h1 className="text-2xl font-bold text-white mb-1 flex items-center gap-3">
                {client.name}
                <ClientStatusBadge status={client.status} />
              </h1>
              <div className="flex flex-wrap items-center gap-4 text-sm text-slate-400">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {client.timezone}
                </span>
                <span className="flex items-center gap-1">
                  Coach: <span className="text-slate-300">{client.coachName}</span>
                </span>
                <span>
                  Last Contact: {new Date(client.lastContactDate).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
           {/* Outcomes Quick View */}
           <div className="flex gap-2 p-1 bg-slate-800 rounded-lg border border-slate-700">
             <div className={`px-3 py-1 rounded text-xs font-semibold ${client.outcomes.hasReview ? 'bg-yellow-500/20 text-yellow-500' : 'text-slate-600'}`}>Review</div>
             <div className={`px-3 py-1 rounded text-xs font-semibold ${client.outcomes.hasReferral ? 'bg-emerald-500/20 text-emerald-500' : 'text-slate-600'}`}>Referral</div>
             <div className={`px-3 py-1 rounded text-xs font-semibold ${client.outcomes.isInnerCircle ? 'bg-purple-500/20 text-purple-500' : 'text-slate-600'}`}>Inner Circle</div>
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
               <div className="text-xs text-slate-500 mb-1">Curriculum Step {client.currentStepIndex + 1} of {client.totalSteps}</div>
               <div className="font-medium text-white text-lg">
                 {client.curriculum[client.currentStepIndex]?.title}
               </div>
               <div className="w-full bg-slate-700 rounded-full h-1.5 mt-3">
                  <div 
                    className="bg-blue-500 h-1.5 rounded-full" 
                    style={{ width: `${(client.currentStepIndex / client.totalSteps) * 100}%` }}
                  />
               </div>
             </div>
             <div className="flex justify-between items-center py-3 border-t border-slate-700/50">
               <span className="text-sm text-slate-400">Onboarding</span>
               <OnboardingBadge status={client.onboardingStatus} />
             </div>
          </Card>

          <Card>
            <CardHeader title="Client Tags" />
            <div className="flex flex-wrap gap-2">
              {client.tags.map(tag => (
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
                      <button className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2">
                        Post Note <Send className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Notes Stream */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    {client.notes.length === 0 ? (
                      <div className="text-center py-10 text-slate-500">
                        No notes yet. Start tracking interactions.
                      </div>
                    ) : (
                      client.notes.map(note => (
                        <div key={note.id} className="group relative pl-4 border-l-2 border-slate-700 hover:border-blue-500 transition-colors">
                           <div className="flex items-center justify-between mb-1">
                             <span className="font-medium text-slate-200 text-sm">{note.author}</span>
                             <span className="text-xs text-slate-500">{new Date(note.timestamp).toLocaleDateString()}</span>
                           </div>
                           <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-line">{note.content}</p>
                           {note.tags.length > 0 && (
                             <div className="flex gap-2 mt-2">
                               {note.tags.map(t => <span key={t} className="text-xs text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">{t}</span>)}
                             </div>
                           )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* PROGRESS TAB */}
              {activeTab === 'PROGRESS' && (
                <div className="p-6 overflow-y-auto h-full">
                  <div className="space-y-4 max-w-2xl">
                    {client.curriculum.map((step, idx) => {
                      const isCurrent = idx === client.currentStepIndex;
                      const isFuture = idx > client.currentStepIndex;
                      const isCompleted = step.isCompleted;

                      return (
                        <div 
                          key={step.id} 
                          className={`flex items-start gap-4 p-4 rounded-xl border transition-all ${
                            isCurrent 
                            ? 'bg-blue-500/5 border-blue-500/50 shadow-md shadow-blue-900/10' 
                            : 'bg-transparent border-slate-700/30 opacity-80 hover:opacity-100'
                          }`}
                        >
                          <div className="mt-0.5">
                            {isCompleted ? (
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
                              Module {idx + 1}: {step.title}
                            </h4>
                            {isCurrent && (
                              <p className="text-xs text-blue-400 mt-1">In Progress • Started 3 days ago</p>
                            )}
                          </div>
                          <div className="opacity-0 group-hover:opacity-100">
                             <button className="text-slate-400 hover:text-white">
                               <MoreHorizontal className="w-4 h-4" />
                             </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* FIELDS TAB (Mock) */}
              {activeTab === 'FIELDS' && (
                <div className="p-6">
                  <div className="grid grid-cols-2 gap-x-8 gap-y-6">
                    <div className="group border-b border-slate-700 pb-2">
                       <label className="text-xs uppercase text-slate-500 mb-1 block">Goal AUM</label>
                       <div className="flex justify-between items-center">
                         <span className="text-slate-200">$500,000</span>
                         <Pencil className="w-3 h-3 text-slate-600 opacity-0 group-hover:opacity-100 cursor-pointer" />
                       </div>
                    </div>
                    <div className="group border-b border-slate-700 pb-2">
                       <label className="text-xs uppercase text-slate-500 mb-1 block">Risk Tolerance</label>
                       <div className="flex justify-between items-center">
                         <span className="text-slate-200">Moderate-High</span>
                         <Pencil className="w-3 h-3 text-slate-600 opacity-0 group-hover:opacity-100 cursor-pointer" />
                       </div>
                    </div>
                    <div className="group border-b border-slate-700 pb-2">
                       <label className="text-xs uppercase text-slate-500 mb-1 block">Preferred Exchange</label>
                       <div className="flex justify-between items-center">
                         <span className="text-slate-200">Binance, Coinbase</span>
                         <Pencil className="w-3 h-3 text-slate-600 opacity-0 group-hover:opacity-100 cursor-pointer" />
                       </div>
                    </div>
                    <div className="group border-b border-slate-700 pb-2">
                       <label className="text-xs uppercase text-slate-500 mb-1 block">Metamask Address</label>
                       <div className="flex justify-between items-center">
                         <span className="text-slate-200 font-mono text-sm">0x71C...9A21</span>
                         <Pencil className="w-3 h-3 text-slate-600 opacity-0 group-hover:opacity-100 cursor-pointer" />
                       </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
