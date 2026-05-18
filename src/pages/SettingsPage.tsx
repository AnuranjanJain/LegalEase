import { useState } from 'react';
import { Settings as SettingsIcon, Shield, Bell, Globe, Moon, Sun, Sparkles } from 'lucide-react';

const settingSections = [
  { icon: Shield, title: 'Security', description: 'Manage passwords, sign-in methods, and access controls.' },
  { icon: Bell, title: 'Notifications', description: 'Configure alerts for documents, tasks, and updates.' },
  { icon: Globe, title: 'Language', description: 'Set your preferred language and regional formatting.' },
  { icon: Sparkles, title: 'Appearance', description: 'Choose the theme and app display options.' },
];

export function SettingsPage() {
  const [darkMode, setDarkMode] = useState(false);
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [productUpdates, setProductUpdates] = useState(false);
  const [language, setLanguage] = useState('English');

  return (
    <div className="app-container py-12 max-w-6xl">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-800 overflow-hidden animate-slide-up">
        <div className="md:flex">
          <aside className="w-full md:w-96 bg-gray-50/80 dark:bg-gray-800/80 border-b md:border-b-0 md:border-r border-gray-100 dark:border-gray-700 p-8">
            <div className="flex items-center gap-3 mb-8">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                <SettingsIcon size={24} />
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">Settings</p>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Preferences</h1>
              </div>
            </div>

            <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
              Fine-tune your LegalEase experience with security, notification, and appearance controls.
            </p>

            <div className="space-y-3">
              {settingSections.map((section) => {
                const Icon = section.icon;
                return (
                  <div key={section.title} className="rounded-3xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-4 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-start gap-3">
                      <div className="mt-1 h-10 w-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                        <Icon size={18} />
                      </div>
                      <div>
                        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{section.title}</h2>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{section.description}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>

          <section className="flex-grow p-8 md:p-10">
            <div className="flex flex-col gap-6">
              <div className="rounded-3xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-950/70 p-8">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <p className="text-sm uppercase tracking-[0.24em] font-semibold text-primary mb-2">App Settings</p>
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-white">General preferences</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                      Configure the app behavior, notifications, and language to match your workflow.
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm text-gray-600 dark:text-gray-300">
                    <Moon size={16} />
                    <span>{darkMode ? 'Dark mode' : 'Light mode'}</span>
                  </div>
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <div className="rounded-3xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900 p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Appearance</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Switch theme and customize interface options.</p>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-gray-100 dark:bg-gray-800 text-sm text-gray-600 dark:text-gray-300">
                      <Sun size={16} />
                      <Moon size={16} />
                    </div>
                  </div>

                  <div className="space-y-5">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">Dark mode</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Enable dark theme for the app.</p>
                      </div>
                      <button
                        type="button"
                        className={`h-7 w-14 rounded-full transition-colors ${darkMode ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700'}`}
                        onClick={() => setDarkMode(!darkMode)}
                      >
                        <span className={`block h-6 w-6 rounded-full bg-white shadow-sm transform transition-transform ${darkMode ? 'translate-x-7' : 'translate-x-1'}`} />
                      </button>
                    </div>
                    <div className="space-y-3">
                      <label className="block text-sm font-semibold text-gray-900 dark:text-white">Preferred language</label>
                      <select
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                        className="w-full rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-3 text-gray-900 dark:text-white focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition"
                      >
                        {['English', 'Spanish', 'French', 'German'].map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900 p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Notifications</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Choose how and when LegalEase notifies you.</p>
                    </div>
                    <Bell size={18} className="text-primary" />
                  </div>

                  <div className="space-y-5">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">Email alerts</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Receive updates about account activity and offers.</p>
                      </div>
                      <button
                        type="button"
                        className={`h-7 w-14 rounded-full transition-colors ${emailAlerts ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700'}`}
                        onClick={() => setEmailAlerts(!emailAlerts)}
                      >
                        <span className={`block h-6 w-6 rounded-full bg-white shadow-sm transform transition-transform ${emailAlerts ? 'translate-x-7' : 'translate-x-1'}`} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">Product updates</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Stay in the loop with new feature announcements.</p>
                      </div>
                      <button
                        type="button"
                        className={`h-7 w-14 rounded-full transition-colors ${productUpdates ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700'}`}
                        onClick={() => setProductUpdates(!productUpdates)}
                      >
                        <span className={`block h-6 w-6 rounded-full bg-white shadow-sm transform transition-transform ${productUpdates ? 'translate-x-7' : 'translate-x-1'}`} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900 p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                  <div className="h-11 w-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                    <Globe size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Account safety</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Keep your information secure and control access to your account.</p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-3xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-950/70 p-4">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">Two-factor authentication</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Add an extra layer of protection to your sign-ins.</p>
                  </div>
                  <div className="rounded-3xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-950/70 p-4">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">Session management</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Review devices and sign out remotely.</p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
