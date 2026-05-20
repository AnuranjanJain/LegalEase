import { Bell, Palette, Shield, Globe, Trash2 } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';

export function SettingsPage() {
  const { showToast } = useToast();

  const handleClearHistory = () => {
    if (window.confirm("Are you sure you want to delete all local chat history? This action is irreversible.")) {
      localStorage.removeItem('chatHistory');
      showToast('Chat history cleared successfully.', 'success');
    }
  };

  return (
    <div className="relative overflow-hidden bg-background-light dark:bg-background-dark min-h-screen text-gray-800 dark:text-gray-200">
      
      {/* Background Graphic Glows */}
      <div className="absolute inset-0 opacity-40 pointer-events-none">
        <div className="absolute top-10 left-10 w-96 h-96 bg-primary-650/5 dark:bg-primary-600/5 rounded-full filter blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-10 right-10 w-80 h-80 bg-blue-800/10 dark:bg-blue-800/5 rounded-full filter blur-[100px] animate-pulse" style={{ animationDelay: '2.5s' }}></div>
      </div>

      <div className="app-container relative z-10 py-12 max-w-4xl">
        
        {/* Header Title Section */}
        <div className="mb-10 pb-4 border-b border-gray-150 dark:border-gray-850">
          <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white dark:bg-gradient-to-r dark:from-white dark:to-blue-200 dark:bg-clip-text dark:text-transparent">
            System Control Center
          </h1>
          <p className="text-gray-650 dark:text-gray-400 text-sm mt-1">
            Configure underlying environment models, audit toast notification systems, and manage active session storage properties.
          </p>
        </div>

        {/* Main Settings Panel Grid */}
        <div className="space-y-8">
          
          {/* --- PANEL 1: TOAST NOTIFICATION TESTING SUITE --- */}
          <div className="bg-white/70 dark:bg-gray-950/40 backdrop-blur-md rounded-2xl border border-gray-150 dark:border-gray-850 p-6 md:p-8 shadow-sm hover:shadow-md transition-shadow">
            
            <div className="flex items-center gap-4 mb-6 pb-4 border-b border-gray-150 dark:border-gray-850/60">
              <div className="h-11 w-11 bg-primary-600/10 text-primary-600 dark:text-primary-400 rounded-xl flex items-center justify-center border border-primary-500/15">
                <Bell size={20} />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-gray-900 dark:text-white">Alert Broadcast System</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Test real-time toast alert dispatches and system responses.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={() => showToast('Operation completed successfully!', 'success')}
                className="px-4 py-3 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl transition-all border border-emerald-500/20 text-xs font-bold text-left flex items-center justify-between"
              >
                <span>Dispatch Success Alert</span>
                <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
              </button>
              <button
                onClick={() => showToast('Failed to connect to local API server.', 'error')}
                className="px-4 py-3 bg-red-500/5 hover:bg-red-500/10 text-red-500 dark:text-red-400 rounded-xl transition-all border border-red-500/20 text-xs font-bold text-left flex items-center justify-between"
              >
                <span>Dispatch Error Alert</span>
                <span className="h-2 w-2 rounded-full bg-red-500"></span>
              </button>
              <button
                onClick={() => showToast('High liability found in Intellectual Property clause.', 'warning')}
                className="px-4 py-3 bg-amber-500/5 hover:bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl transition-all border border-amber-500/20 text-xs font-bold text-left flex items-center justify-between"
              >
                <span>Dispatch Warning Alert</span>
                <span className="h-2 w-2 rounded-full bg-amber-500"></span>
              </button>
              <button
                onClick={() => showToast('AI Sandbox loaded with local context.', 'info')}
                className="px-4 py-3 bg-blue-500/5 hover:bg-blue-500/10 text-primary rounded-xl transition-all border border-blue-500/20 text-xs font-bold text-left flex items-center justify-between"
              >
                <span>Dispatch Information Alert</span>
                <span className="h-2 w-2 rounded-full bg-blue-500"></span>
              </button>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-150 dark:border-gray-850/60">
              <button
                onClick={() => {
                  showToast('Initializing secure pipeline...', 'info');
                  setTimeout(() => showToast('Analyzing structure...', 'warning'), 600);
                  setTimeout(() => showToast('Liabilities extracted successfully!', 'success'), 1200);
                }}
                className="w-full px-4 py-3.5 bg-primary-600 hover:bg-primary-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-primary-500/15"
              >
                Execute Multiple Alert Cascade Sequence
              </button>
            </div>

          </div>

          {/* --- PANEL 2: THEME & APPEARANCE CONTROLS --- */}
          <div className="bg-white/70 dark:bg-gray-950/40 backdrop-blur-md rounded-2xl border border-gray-150 dark:border-gray-850 p-6 md:p-8 shadow-sm hover:shadow-md transition-shadow">
            
            <div className="flex items-center gap-4 mb-5 pb-4 border-b border-gray-150 dark:border-gray-850/60">
              <div className="h-11 w-11 bg-primary-600/10 text-primary-600 dark:text-primary-400 rounded-xl flex items-center justify-center border border-primary-500/15">
                <Palette size={20} />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-gray-900 dark:text-white">Interface Personalization</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Customize default visualization palettes and theme alignments.</p>
              </div>
            </div>

            <div className="flex justify-between items-center p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-950/20">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-gray-800 dark:text-gray-250">Theme Mode</p>
                <p className="text-xs text-gray-550 dark:text-gray-400 mt-1">Switch between light and dark backgrounds utilizing the theme toggle located in the main header panel.</p>
              </div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-600/10 text-primary border border-primary/20 text-xs font-bold">
                Adaptive HSL
              </span>
            </div>

          </div>

          {/* --- PANEL 3: PRIVACY & DATA PERSISTENCE --- */}
          <div className="bg-white/70 dark:bg-gray-950/40 backdrop-blur-md rounded-2xl border border-gray-150 dark:border-gray-850 p-6 md:p-8 shadow-sm hover:shadow-md transition-shadow">
            
            <div className="flex items-center gap-4 mb-5 pb-4 border-b border-gray-150 dark:border-gray-850/60">
              <div className="h-11 w-11 bg-primary-600/10 text-primary-600 dark:text-primary-400 rounded-xl flex items-center justify-center border border-primary-500/15">
                <Shield size={20} />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-gray-900 dark:text-white">Privacy Safeguards</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Manage data retention and delete local storage entries.</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 rounded-xl border border-red-500/15 bg-red-500/5 dark:bg-red-950/10">
              <div className="max-w-md">
                <p className="text-xs font-bold uppercase tracking-wider text-red-500">Purge Chat Database</p>
                <p className="text-xs text-gray-550 dark:text-gray-400 mt-1">Irreversibly delete all saved chat history messages from local cache storage.</p>
              </div>
              <button
                onClick={handleClearHistory}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-red-500 text-white rounded-lg text-xs font-bold hover:bg-red-650 transition-colors shadow-md shadow-red-500/15 self-end sm:self-center"
              >
                <Trash2 size={13} />
                <span>Clear History</span>
              </button>
            </div>

          </div>

          {/* --- PANEL 4: LANGUAGE AND REGIONAL PREFERENCES --- */}
          <div className="bg-white/70 dark:bg-gray-950/40 backdrop-blur-md rounded-2xl border border-gray-150 dark:border-gray-850 p-6 md:p-8 shadow-sm hover:shadow-md transition-shadow">
            
            <div className="flex items-center gap-4 mb-5 pb-4 border-b border-gray-150 dark:border-gray-850/60">
              <div className="h-11 w-11 bg-primary-600/10 text-primary-600 dark:text-primary-400 rounded-xl flex items-center justify-center border border-primary-500/15">
                <Globe size={20} />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-gray-900 dark:text-white">Regionalization Preferences</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Set display languages and align reporting dates.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">Display Language Selection</label>
                <select
                  onChange={(e) => showToast(`System display language aligned to ${e.target.value}`, 'info')}
                  className="w-full px-4 py-3 bg-gray-50/50 dark:bg-gray-950/20 border border-gray-200 dark:border-gray-800 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/60 transition-all outline-none"
                >
                  <option>English</option>
                  <option>Spanish (Español)</option>
                  <option>French (Français)</option>
                  <option>German (Deutsch)</option>
                </select>
              </div>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}
