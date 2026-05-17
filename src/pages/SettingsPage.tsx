import { Settings as SettingsIcon, Construction } from 'lucide-react';

export function SettingsPage() {
  return (
    <div className="app-container py-12 max-w-5xl">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-800 overflow-hidden flex flex-col items-center justify-center min-h-[600px] animate-slide-up text-center p-8">
        <div className="h-24 w-24 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-6 relative">
          <SettingsIcon size={48} className="animate-[spin_4s_linear_infinite]" />
          <div className="absolute -bottom-2 -right-2 bg-white dark:bg-gray-900 rounded-full p-1 shadow-sm">
            <Construction size={24} className="text-orange-500" />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Settings</h1>
        <p className="text-lg text-gray-500 dark:text-gray-400 max-w-md">
          This page is currently under construction. Check back later for configuration options.
        </p>
      </div>
    </div>
  );
}
