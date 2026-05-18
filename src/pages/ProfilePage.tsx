import { User, Bell, Shield, Globe, Check, Eye, EyeOff, Trash2, FileText, Info } from 'lucide-react';
import { StorageService, UserProfile } from '../services/storage';
import { useState } from 'react';
import { useToast } from '../contexts/ToastContext';
import { useParams, useNavigate } from 'react-router-dom';
import { useNotifications, AppNotification } from '../contexts/NotificationContext';

type Section = 'profile' | 'security' | 'notifications' | 'language';

const VALID_TABS: Section[] = ['profile', 'security', 'notifications', 'language'];

const LANGUAGES = [
  { code: 'en', name: 'English', native: 'English' },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी' },
  { code: 'fr', name: 'French', native: 'Français' },
  { code: 'es', name: 'Spanish', native: 'Español' },
  { code: 'ar', name: 'Arabic', native: 'العربية' },
  { code: 'de', name: 'German', native: 'Deutsch' },
  { code: 'pt', name: 'Portuguese', native: 'Português' },
  { code: 'zh', name: 'Chinese', native: '中文' },
];

const TIMEZONES = [
  { value: 'IST', label: 'Asia/Kolkata (IST, UTC+5:30)' },
  { value: 'EST', label: 'America/New_York (EST, UTC-5:00)' },
  { value: 'PST', label: 'America/Los_Angeles (PST, UTC-8:00)' },
  { value: 'GMT', label: 'Europe/London (GMT, UTC+0:00)' },
  { value: 'GST', label: 'Asia/Dubai (GST, UTC+4:00)' },
  { value: 'SGT', label: 'Asia/Singapore (SGT, UTC+8:00)' },
];

const DATE_FORMATS = [
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY (31/12/2025)' },
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY (12/31/2025)' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (2025-12-31)' },
];

function timeAgo(date: Date): string {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function notifTypeLabel(type: AppNotification['type']) {
  if (type === 'document') return { label: 'Document', icon: <FileText size={13} />, cls: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' };
  if (type === 'security') return { label: 'Security', icon: <Shield size={13} />, cls: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' };
  return { label: 'System', icon: <Info size={13} />, cls: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400' };
}

// ─── Toggle component ────────────────────────────────────────────────────────
function Toggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button
      onClick={onChange}
      aria-pressed={checked}
      aria-label={label}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${checked ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700'}`}
    >
      <span className={`inline-block h-4 w-4 transform bg-white rounded-full shadow-sm transition-transform ${checked ? 'translate-x-5' : 'translate-x-1'}`} />
    </button>
  );
}

// ─── Section header ──────────────────────────────────────────────────────────
function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="mb-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>
    </header>
  );
}

// ─── Field wrapper ───────────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">{label}</label>
      {children}
    </div>
  );
}

const inputCls = 'w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 rounded-xl px-4 py-3 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none';
const readOnlyCls = 'w-full bg-gray-100 dark:bg-gray-800/80 border border-gray-100 dark:border-gray-700 rounded-xl px-4 py-3 text-gray-500 dark:text-gray-400 cursor-not-allowed outline-none';


export function ProfilePage() {
  const initialProfile = useState(() => StorageService.getProfile())[0];
  const [profile, setProfile] = useState<UserProfile>(StorageService.getProfile());
  const [isSaving, setIsSaving] = useState(false);
  const [showSavedToast, setShowSavedToast] = useState(false);
  
  const { showToast } = useToast();
 
 
  const { tab } = useParams<{ tab?: string }>();
  const navigate = useNavigate();

  // Security state
  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' });
  const [showPw, setShowPw] = useState({ current: false, newPw: false, confirm: false });
  const [twoFa, setTwoFa] = useState(false);
  const [changingPw, setChangingPw] = useState(false);

  // Language/region state
  const [selectedLang, setSelectedLang] = useState(profile.preferences.language || 'en');
  const [timezone, setTimezone] = useState(profile.preferences.timezone || 'EST');
  const [dateFormat, setDateFormat] = useState('DD/MM/YYYY');

  // Notifications from shared context
  const { notifications, unreadCount, markAllRead, markRead, removeNotification } = useNotifications();

  // Sync section from URL param
  const section: Section = VALID_TABS.includes(tab as Section) ? (tab as Section) : 'profile';

  const setSection = (s: Section) => {
    navigate(s === 'profile' ? '/profile' : `/profile/${s}`, { replace: true });
  };

  const updateField = (path: string, value: any) => {
    const newProfile = { ...profile };
    if (path.includes('.')) {
      const [parent, child] = path.split('.');
      (newProfile as any)[parent] = { ...(newProfile as any)[parent], [child]: value };
    } else {
      (newProfile as any)[path] = value;
    }
    setProfile(newProfile);
  };

  const updateNotificationPref = (key: keyof UserProfile['preferences']['notifications']) => {
    const newProfile = { ...profile };
    newProfile.preferences.notifications[key] = !newProfile.preferences.notifications[key];
    setProfile(newProfile);
  };

  const handleSaveProfile = () => {
    setIsSaving(true);
    StorageService.saveProfile(profile);
    setTimeout(() => {
      setIsSaving(false);
      showToast('Profile updated successfully!', 'success');
    }, 800);
  };

  const handleChangePassword = () => {
    if (!pwForm.current) { showToast('Enter your current password.', 'error'); return; }
    if (pwForm.newPw.length < 8) { showToast('New password must be at least 8 characters.', 'error'); return; }
    if (pwForm.newPw !== pwForm.confirm) { showToast('Passwords do not match.', 'error'); return; }
    setChangingPw(true);
    setTimeout(() => {
      setChangingPw(false);
      setPwForm({ current: '', newPw: '', confirm: '' });
      showToast('Password updated successfully!', 'success');
    }, 1000);
  };

  const handleSaveNotifPrefs = () => {
    StorageService.saveProfile(profile);
    showToast('Notification preferences saved!', 'success');
  };

  const handleSaveLanguage = () => {
    const newProfile = { ...profile };
    newProfile.preferences.language = selectedLang;
    newProfile.preferences.timezone = timezone;
    setProfile(newProfile);
    StorageService.saveProfile(newProfile);
    showToast('Language & region saved!', 'success');
  };

  const sidebarItems = [
    { icon: User, label: 'Profile', key: 'profile' as Section },
    { icon: Shield, label: 'Security', key: 'security' as Section },
    { icon: Bell, label: 'Notifications', key: 'notifications' as Section, badge: unreadCount },
    { icon: Globe, label: 'Language', key: 'language' as Section },
  ];

  return (
    <div className="app-container py-12 max-w-5xl">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-800 overflow-hidden flex flex-col md:flex-row min-h-[600px] animate-slide-up">

        {/* Sidebar */}
        <div className="w-full md:w-72 bg-gray-50/50 dark:bg-gray-800/50 border-b md:border-b-0 md:border-r border-gray-100 dark:border-gray-800 p-8">
          <div className="flex flex-col items-center md:items-start text-center md:text-left">
            <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4">
              <User size={24} />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{profile.firstName} {profile.lastName}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">{profile.email}</p>

            <nav className="w-full space-y-1">
              {sidebarItems.map((item) => {
                const active = section === item.key;
                return (
                  <button
                    key={item.label}
                    onClick={() => setSection(item.key)}
                    aria-current={active}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${active ? 'bg-white dark:bg-gray-800 text-primary shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-gray-800/50'}`}
                  >
                    <item.icon size={18} />
                    <span className="flex-1 text-left">{item.label}</span>
                    {item.badge ? (
                      <span className="text-xs font-semibold bg-red-500 text-white rounded-full h-5 min-w-[20px] flex items-center justify-center px-1">
                        {item.badge}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Content */}
        <div className="flex-grow p-8 md:p-12 overflow-y-auto">

          {/* ── PROFILE ── */}
          {section === 'profile' && (
            <>
              <SectionHeader title="Profile Information" subtitle="Update your personal details and public profile." />
              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Field label="First Name">
                    <input type="text" value={profile.firstName} onChange={(e) => updateField('firstName', e.target.value)} className={inputCls} />
                  </Field>
                  <Field label="Last Name">
                    <input type="text" value={profile.lastName} onChange={(e) => updateField('lastName', e.target.value)} className={inputCls} />
                  </Field>
                  <Field label="Email">
                    <input type="email" value={profile.email} readOnly className={readOnlyCls} />
                  </Field>
                  <Field label="Phone">
                    <input type="text" value={profile.phone} onChange={(e) => updateField('phone', e.target.value)} className={inputCls} />
                  </Field>
                </div>
                <Field label="Bio">
                  <textarea rows={3} value={profile.bio} onChange={(e) => updateField('bio', e.target.value)} className={`${inputCls} resize-none`} />
                </Field>
                <div className="pt-6 flex justify-end gap-4">
                  <button onClick={() => setProfile(StorageService.getProfile())} className="px-6 py-2.5 text-sm font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                    Reset
                  </button>
                  <button onClick={handleSaveProfile} disabled={isSaving} className="px-8 py-2.5 bg-primary text-white rounded-xl font-bold hover:shadow-lg hover:shadow-primary/30 active:scale-95 transition-all disabled:opacity-70 flex items-center gap-2">
                    {isSaving ? (<><div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving...</>) : 'Save Changes'}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* ── SECURITY ── */}
          {section === 'security' && (
            <>
              <SectionHeader title="Security Settings" subtitle="Manage your password and two-factor authentication." />
              <div className="space-y-8 max-w-lg">

                {/* Change Password */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Change Password</h3>

                  {(['current', 'newPw', 'confirm'] as const).map((field) => {
                    const labels = { current: 'Current password', newPw: 'New password', confirm: 'Confirm new password' };
                    return (
                      <div key={field} className="relative">
                        <input
                          type={showPw[field] ? 'text' : 'password'}
                          placeholder={labels[field]}
                          value={pwForm[field]}
                          onChange={(e) => setPwForm((p) => ({ ...p, [field]: e.target.value }))}
                          className={`${inputCls} pr-12`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPw((p) => ({ ...p, [field]: !p[field] }))}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                          aria-label={showPw[field] ? 'Hide password' : 'Show password'}
                        >
                          {showPw[field] ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    );
                  })}

                  <p className="text-xs text-gray-400 dark:text-gray-500">Minimum 8 characters, at least one uppercase letter and number.</p>

                  <button
                    onClick={handleChangePassword}
                    disabled={changingPw}
                    className="px-6 py-2.5 bg-primary text-white rounded-xl font-bold hover:shadow-lg hover:shadow-primary/30 active:scale-95 transition-all disabled:opacity-70 flex items-center gap-2"
                  >
                    {changingPw ? (<><div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Updating...</>) : 'Update Password'}
                  </button>
                </div>

                <div className="border-t border-gray-100 dark:border-gray-800 pt-8 space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Two-Factor Authentication</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Add an extra layer of security using an authenticator app like Google Authenticator or Authy.</p>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                      <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${twoFa ? 'bg-green-100 dark:bg-green-900/30 text-green-600' : 'bg-gray-100 dark:bg-gray-700 text-gray-400'}`}>
                        <Shield size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">Authenticator app</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{twoFa ? 'Enabled — your account is protected' : 'Currently disabled'}</p>
                      </div>
                    </div>
                    <Toggle checked={twoFa} onChange={() => { setTwoFa((v) => !v); showToast(twoFa ? '2FA disabled.' : '2FA enabled!', twoFa ? 'info' : 'success'); }} label="Toggle two-factor authentication" />
                  </div>
                </div>

                <div className="border-t border-gray-100 dark:border-gray-800 pt-8">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Active Sessions</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Devices currently logged into your account.</p>

                  {[
                    { device: 'Chrome on Windows', location: 'Vadodara, India', time: 'Active now', current: true },
                    { device: 'Safari on iPhone', location: 'Mumbai, India', time: '2 days ago', current: false },
                  ].map((session) => (
                    <div key={session.device} className="flex items-center justify-between p-3 mb-2 rounded-xl border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                      <div>
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{session.device}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{session.location} · {session.time}</p>
                      </div>
                      {session.current ? (
                        <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-primary/10 text-primary">This device</span>
                      ) : (
                        <button className="text-xs text-red-500 hover:text-red-700 font-medium px-2.5 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors" onClick={() => showToast('Session revoked.', 'info')}>
                          Revoke
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ── NOTIFICATIONS ── */}
          {section === 'notifications' && (
            <>
              <SectionHeader title="Notification Preferences" subtitle="Choose how you receive alerts and updates." />
              <div className="space-y-8 max-w-2xl">

                {/* Notification Preferences Toggles */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">Email notifications</h3>
                  <div className="divide-y divide-gray-100 dark:divide-gray-800 border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden">
                    {([
                      { key: 'documents' as const, title: 'Document alerts', desc: 'Get notified when documents are uploaded or analyzed.' },
                      { key: 'security' as const, title: 'Security alerts', desc: 'Login attempts, password changes, and 2FA events.' },
                      { key: 'marketing' as const, title: 'Product updates', desc: 'New features, tips, and LegalEase announcements.' },
                    ]).map(({ key, title, desc }) => (
                      <div key={key} className="flex items-center justify-between px-4 py-3.5 bg-white dark:bg-gray-900/50">
                        <div>
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{title}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{desc}</p>
                        </div>
                        <Toggle checked={profile.preferences.notifications[key]} onChange={() => updateNotificationPref(key)} label={`Toggle ${title}`} />
                      </div>
                    ))}
                  </div>
                </div>

                <button onClick={handleSaveNotifPrefs} className="px-6 py-2.5 bg-primary text-white rounded-xl font-bold hover:shadow-lg hover:shadow-primary/30 active:scale-95 transition-all">
                  Save preferences
                </button>

                {/* Recent notifications from the shared context */}
                <div className="border-t border-gray-100 dark:border-gray-800 pt-8">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">Recent notifications</h3>
                    {unreadCount > 0 && (
                      <button onClick={markAllRead} className="text-xs text-primary hover:underline">
                        Mark all as read
                      </button>
                    )}
                  </div>

                  {notifications.length === 0 ? (
                    <div className="text-center py-10 border border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
                      <Bell size={24} className="mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                      <p className="text-sm text-gray-400">No notifications yet</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100 dark:divide-gray-800 border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden">
                      {notifications.map((n) => {
                        const { cls, icon, label } = notifTypeLabel(n.type);
                        return (
                          <div key={n.id} className={`flex items-start gap-3 px-4 py-3.5 transition-colors ${!n.read ? 'bg-primary/5 dark:bg-primary/10' : 'bg-white dark:bg-gray-900/50'}`}>
                            <div className="mt-0.5 flex-shrink-0">
                              <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${cls}`}>
                                {icon}{label}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-medium ${!n.read ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>{n.title}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{n.description}</p>
                              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{timeAgo(n.timestamp)}</p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {!n.read && (
                                <button onClick={() => markRead(n.id)} className="text-xs text-primary hover:underline">
                                  Mark read
                                </button>
                              )}
                              <button onClick={() => removeNotification(n.id)} className="text-gray-400 hover:text-red-500 transition-colors" aria-label="Remove notification">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* ── LANGUAGE ── */}
          {section === 'language' && (
            <>
              <SectionHeader title="Language & Region" subtitle="Set your preferred language and date/time format." />
              <div className="space-y-8 max-w-lg">

                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">Display language</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {LANGUAGES.map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => setSelectedLang(lang.code)}
                        className={`flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-all ${selectedLang === lang.code ? 'border-primary bg-primary/5 dark:bg-primary/10' : 'border-gray-100 dark:border-gray-700 hover:border-primary/40 hover:bg-gray-50 dark:hover:bg-gray-800/40'}`}
                      >
                        <div>
                          <p className={`text-sm font-medium ${selectedLang === lang.code ? 'text-primary' : 'text-gray-800 dark:text-gray-200'}`}>{lang.name}</p>
                          <p className="text-xs text-gray-400 dark:text-gray-500">{lang.native}</p>
                        </div>
                        {selectedLang === lang.code && <Check size={15} className="text-primary flex-shrink-0" />}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="border-t border-gray-100 dark:border-gray-800 pt-8 space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">Date & time</h3>

                  <Field label="Date format">
                    <select value={dateFormat} onChange={(e) => setDateFormat(e.target.value)} className={inputCls}>
                      {DATE_FORMATS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                    </select>
                  </Field>

                  <Field label="Time zone">
                    <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className={inputCls}>
                      {TIMEZONES.map((tz) => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
                    </select>
                  </Field>
                </div>

                <div className="pt-2 flex justify-end">
                  <button onClick={handleSaveLanguage} className="px-8 py-2.5 bg-primary text-white rounded-xl font-bold hover:shadow-lg hover:shadow-primary/30 active:scale-95 transition-all">
                    Save changes
                  </button>
                </div>
              </div>
            </>
          )}

            <div className="pt-10 flex justify-end gap-4">
          
                <button onClick={() => setProfile(initialProfile)}>
              
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
        </div>
      </div>
    </div>
  );
}