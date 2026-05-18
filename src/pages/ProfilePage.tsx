import { User, Bell, Shield, Globe, Check, Lock, MapPin } from 'lucide-react';
import { StorageService, UserProfile } from '../services/storage';
import { useState } from 'react';

type Section = 'profile' | 'security' | 'notifications' | 'language';

export function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile>(StorageService.getProfile());
  const [isSaving, setIsSaving] = useState(false);
  const [showSavedToast, setShowSavedToast] = useState(false);
  const [section, setSection] = useState<Section>('profile');
  const [langOpen, setLangOpen] = useState(false);

  const handleSave = () => {
    setIsSaving(true);
    StorageService.saveProfile(profile);
    setTimeout(() => {
      setIsSaving(false);
      setShowSavedToast(true);
      setTimeout(() => setShowSavedToast(false), 3000);
    }, 800);
  };

  const updateField = (path: string, value: any) => {
    const newProfile = { ...profile };
    // Simple deep update for nested objects
    if (path.includes('.')) {
      const [parent, child] = path.split('.');
      (newProfile as any)[parent] = { ...(newProfile as any)[parent], [child]: value };
    } else {
      (newProfile as any)[path] = value;
    }
    setProfile(newProfile);
  };

  const updateNotification = (key: keyof UserProfile['preferences']['notifications']) => {
    const newProfile = { ...profile };
    newProfile.preferences.notifications[key] = !newProfile.preferences.notifications[key];
    setProfile(newProfile);
  };

  return (
    <div className="app-container py-12 max-w-5xl">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-800 overflow-hidden flex flex-col md:flex-row min-h-[600px] animate-slide-up">

        {/* Card Sidebar */}
        <div className="w-full md:w-80 bg-gray-50/50 dark:bg-gray-800/50 border-b md:border-b-0 md:border-r border-gray-100 dark:border-gray-800 p-8">
          <div className="flex flex-col items-center md:items-start text-center md:text-left">
            <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-6">
              <User size={24} />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{profile.firstName} {profile.lastName}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">{profile.email}</p>

            <nav className="w-full space-y-1">
              {[
                { icon: User, label: 'Profile', key: 'profile' as Section },
                { icon: Shield, label: 'Security', key: 'security' as Section },
                { icon: Bell, label: 'Notifications', key: 'notifications' as Section },
                { icon: Globe, label: 'Language', key: 'language' as Section },
              ].map((item) => {
                const active = section === item.key;
                return (
                  <button
                    key={item.label}
                    onClick={() => setSection(item.key)}
                    aria-current={active}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${active ? 'bg-white dark:bg-gray-800 text-primary shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-gray-800/50'}`}
                  >
                    <item.icon size={18} />
                    {item.label}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Card Content */}
        <div className="flex-grow p-8 md:p-12">
          <header className="mb-10 flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{section === 'profile' ? 'Profile Information' : section === 'security' ? 'Security Settings' : section === 'notifications' ? 'Notification Preferences' : 'Language & Region'}</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{section === 'profile' ? 'Update your personal details and public profile.' : section === 'security' ? 'Manage password and two-factor authentication.' : section === 'notifications' ? 'Choose how you receive alerts and updates.' : 'Select your preferred language and region.'}</p>
            </div>
            {showSavedToast && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 text-xs font-bold rounded-full animate-bounce">
                <Check size={14} /> SAVED
              </div>
            )}
          </header>
          {/* Content: switch between sections */}
          {section === 'profile' && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">First Name</label>
                  <input
                    type="text"
                    value={profile.firstName}
                    onChange={(e) => updateField('firstName', e.target.value)}
                    className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 rounded-xl px-4 py-3 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">Last Name</label>
                  <input
                    type="text"
                    value={profile.lastName}
                    onChange={(e) => updateField('lastName', e.target.value)}
                    className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 rounded-xl px-4 py-3 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">Email</label>
                  <input
                    type="email"
                    value={profile.email}
                    readOnly
                    className="w-full bg-gray-100 dark:bg-gray-800/80 border border-gray-100 dark:border-gray-700 rounded-xl px-4 py-3 text-gray-500 dark:text-gray-400 cursor-not-allowed outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">Phone</label>
                  <input
                    type="text"
                    value={profile.phone}
                    onChange={(e) => updateField('phone', e.target.value)}
                    className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 rounded-xl px-4 py-3 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">Bio</label>
                <textarea
                  rows={3}
                  value={profile.bio}
                  onChange={(e) => updateField('bio', e.target.value)}
                  className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 rounded-xl px-4 py-3 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none resize-none"
                />
              </div>

              {/* Notification preferences moved to dedicated Notifications section */}

              <div className="pt-10 flex justify-end gap-4">
                <button
                  onClick={() => setProfile(StorageService.getProfile())}
                  className="px-6 py-2.5 text-sm font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                >
                  Reset
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="px-8 py-2.5 bg-primary text-white rounded-xl font-bold hover:shadow-lg hover:shadow-primary/30 active:scale-95 transition-all disabled:opacity-70 flex items-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Saving...
                    </>
                  ) : 'Save Changes'}
                </button>
              </div>
            </div>
          )}

          {section === 'security' && (
            <div className="space-y-6">
              <div className="space-y-2 max-w-lg">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">Change Password</label>
                <input type="password" placeholder="Current password" className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 rounded-xl px-4 py-3" />
                <input type="password" placeholder="New password" className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 rounded-xl px-4 py-3" />
                <input type="password" placeholder="Confirm new password" className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 rounded-xl px-4 py-3" />
                <div className="pt-4">
                  <button className="px-6 py-2.5 bg-primary text-white rounded-xl font-bold">Update Password</button>
                </div>
              </div>

              <div className="pt-6 border-t border-gray-100 dark:border-gray-800">
                <h3 className="text-sm font-semibold">Two-Factor Authentication</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Enable or disable 2FA for added account security.</p>
                <div className="mt-4 flex items-center gap-4">
                  <button className="px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-xl">Enable</button>
                  <button className="px-4 py-2 bg-gray-50 dark:bg-gray-900 rounded-xl">Disable</button>
                </div>
              </div>
            </div>
          )}

          {section === 'notifications' && (
            <div className="space-y-6 max-w-2xl">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">Document Alerts</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Get notified when documents are analyzed.</p>
                  </div>
                  <button
                    onClick={() => updateNotification('documents')}
                    aria-pressed={profile.preferences.notifications.documents}
                    aria-label="Toggle document alerts"
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${profile.preferences.notifications.documents ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform bg-white rounded-full shadow-sm transition-transform ${profile.preferences.notifications.documents ? 'translate-x-5' : 'translate-x-1'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">Security Alerts</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Login attempts and password changes.</p>
                  </div>
                  <button
                    onClick={() => updateNotification('security')}
                    aria-pressed={profile.preferences.notifications.security}
                    aria-label="Toggle security alerts"
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${profile.preferences.notifications.security ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform bg-white rounded-full shadow-sm transition-transform ${profile.preferences.notifications.security ? 'translate-x-5' : 'translate-x-1'}`} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {section === 'language' && (
            <div className="space-y-6 max-w-md">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">Preferred Language</label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setLangOpen((s) => !s)}
                  aria-expanded={langOpen}
                  className="w-full flex items-center justify-between gap-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 rounded-xl px-4 py-3 text-left"
                >
                  <div className="flex items-center gap-3">
                    <Check size={16} className="text-primary" />
                    <span className="text-gray-900 dark:text-white">English</span>
                  </div>
                  <span className="text-gray-400">▾</span>
                </button>

                {langOpen && (
                  <ul className="absolute z-20 mt-2 w-full bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg shadow-md overflow-hidden">
                    <li className="px-4 py-3 flex items-center gap-3 text-sm text-gray-900 dark:text-white">
                      <Check size={16} className="text-primary" />
                      English
                    </li>
                  </ul>
                )}
              </div>

              {/* Regions removed — language is English-only */}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
