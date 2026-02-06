import React, { useState } from 'react';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { ClientProfile } from './pages/ClientProfile';
import { AdminUsers } from './pages/AdminUsers';
import { ViewState } from './types';
import { AuthProvider, useAuth, useIsAdmin } from './context/AuthContext';
import { LayoutDashboard, Users, Settings, LogOut, UserCog } from 'lucide-react';

function AppContent() {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const isAdmin = useIsAdmin();
  const [view, setView] = useState<ViewState>('DASHBOARD');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  const navigateTo = (newView: ViewState, clientId?: string) => {
    setView(newView);
    if (clientId) setSelectedClientId(clientId);
  };

  const handleLogout = async () => {
    await logout();
  };

  const SidebarItem = ({ icon: Icon, label, active, onClick }: any) => (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
        active
        ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
        : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
      }`}
    >
      <Icon className="w-5 h-5" />
      {label}
    </button>
  );

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Not authenticated - show login
  if (!isAuthenticated) {
    return <Login onLogin={() => setView('DASHBOARD')} />;
  }

  return (
    <div className="flex h-screen bg-slate-900 overflow-hidden">

      {/* SIDEBAR */}
      <div className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col hidden md:flex">
        <div className="p-6">
          <div className="flex items-center gap-2 mb-8">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white">
              CS
            </div>
            <span className="font-bold text-white tracking-tight">Success Tracker</span>
          </div>

          <nav className="space-y-1">
            <SidebarItem
              icon={LayoutDashboard}
              label="Dashboard"
              active={view === 'DASHBOARD'}
              onClick={() => navigateTo('DASHBOARD')}
            />
            <SidebarItem
              icon={Users}
              label="My Clients"
              active={view === 'CLIENT_PROFILE'}
              onClick={() => navigateTo('DASHBOARD')}
            />
            {isAdmin && (
              <SidebarItem
                icon={UserCog}
                label="Manage Users"
                active={view === 'ADMIN_USERS'}
                onClick={() => navigateTo('ADMIN_USERS' as ViewState)}
              />
            )}
            <SidebarItem
              icon={Settings}
              label="Settings"
              active={view === 'SETTINGS'}
              onClick={() => {}}
            />
          </nav>
        </div>

        <div className="mt-auto p-6 border-t border-slate-800">
           <div className="flex items-center gap-3 mb-4">
             {user?.avatar ? (
               <img src={user.avatar} className="w-8 h-8 rounded-full" alt={user.name} />
             ) : (
               <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-white text-sm font-bold">
                 {user?.name?.substring(0, 2).toUpperCase()}
               </div>
             )}
             <div className="flex-1 min-w-0">
               <div className="text-sm font-medium text-white truncate">{user?.name}</div>
               <div className="text-xs text-slate-500 truncate">{user?.role}</div>
             </div>
           </div>
           <button
             onClick={handleLogout}
             className="w-full flex items-center gap-2 text-xs text-slate-500 hover:text-rose-400 transition-colors"
           >
             <LogOut className="w-4 h-4" /> Sign Out
           </button>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* TOP BAR (Mobile trigger would go here) */}
        <header className="h-16 border-b border-slate-800 bg-slate-900 flex items-center justify-between px-6 md:hidden">
          <span className="font-bold text-white">Success Tracker</span>
          <button className="text-slate-400">Menu</button>
        </header>

        {/* SCROLLABLE VIEW */}
        <main className="flex-1 overflow-auto p-6 md:p-8">
          {view === 'DASHBOARD' && (
            <Dashboard onNavigateToClient={(id) => navigateTo('CLIENT_PROFILE', id)} />
          )}

          {view === 'CLIENT_PROFILE' && selectedClientId && (
            <ClientProfile
              clientId={selectedClientId}
              onBack={() => navigateTo('DASHBOARD')}
            />
          )}

          {view === 'ADMIN_USERS' && isAdmin && (
            <AdminUsers />
          )}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}