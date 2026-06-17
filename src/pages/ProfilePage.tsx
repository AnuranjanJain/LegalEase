import { User, Bell, Shield, Globe, Check, Eye, EyeOff, Trash2, FileText, Info, Key, Monitor, Smartphone, RefreshCcw } from 'lucide-react';
import { StorageService, UserProfile } from '../services/storage';
import { useState } from 'react';
import { useToast } from '../contexts/ToastContext';
import { useParams, useNavigate } from 'react-router-dom';
import { useNotifications, AppNotification } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
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
  if (type === 'document') return { label: 'Document', icon: <FileText size={13} />, cls: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-500/10' };
  if (type === 'security') return { label: 'Security', icon: <Shield size={13} />, cls: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-500/10' };
  return { label: 'System', icon: <Info size={13} />, cls: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 border border-transparent' };
}

// ─── Modern Toggle component ────────────────────────────────────────────────────────
interface ToggleProps {
  checked: boolean;
  onChange: () => void;
  label: string;
}

function Toggle({ checked, onChange, label }: ToggleProps) {
  return (
    <button
      onClick={onChange}
      aria-pressed={checked}
      aria-label={label}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-300 focus:outline-none ${
        checked ? 'bg-primary-600 shadow-[0_0_10px_rgba(37,99,235,0.3)]' : 'bg-gray-250 dark:bg-gray-800'
      }`}
    >
      <span className={`inline-block h-4 w-4 transform bg-white rounded-full shadow-md transition-transform duration-300 ${
        checked ? 'translate-x-6' : 'translate-x-1'
      }`} />
    </button>
  );
}

// ─── Modern Section header ──────────────────────────────────────────────────────────
function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="mb-8 pb-4 border-b border-gray-150 dark:border-gray-850">
      <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">{title}</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>
    </header>
  );
}

// ─── Premium Field wrapper ───────────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400 dark:text-gray-500 block">{label}</label>
      {children}
    </div>
  );
}

const inputCls = 'w-full bg-gray-50/50 dark:bg-gray-950/20 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary/60 transition-all outline-none';
const readOnlyCls = 'w-full bg-gray-100 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3 text-sm text-gray-500 dark:text-gray-400 cursor-not-allowed outline-none';

export function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile>(StorageService.getProfile());
  const [isSaving, setIsSaving] = useState(false);
  const { showToast } = useToast();
  const { logout } = useAuth();
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

  const handleChangePassword = async () => {
    if (!pwForm.current) { showToast('Enter your current password.', 'error'); return; }
    if (pwForm.newPw.length < 8) { showToast('New password must be at least 8 characters.', 'error'); return; }
    if (pwForm.newPw !== pwForm.confirm) { showToast('Passwords do not match.', 'error'); return; }

    setChangingPw(true);
    try {
      await api.post<{ detail: string }>('/auth/change-password', {
        current_password: pwForm.current,
        new_password: pwForm.newPw,
      });
      setPwForm({ current: '', newPw: '', confirm: '' });
      showToast('Password updated. Please sign in again.', 'success');
      logout();
      navigate('/login');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update password.';
      showToast(message, 'error');
    } finally {
      setChangingPw(false);
    }
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
    showToast('Language & region settings saved!', 'success');
  };

  const sidebarItems = [
    { icon: User, label: 'Profile Details', key: 'profile' as Section },
    { icon: Shield, label: 'Security & Signin', key: 'security' as Section },
    { icon: Bell, label: 'System Alerts', key: 'notifications' as Section, badge: unreadCount },
    { icon: Globe, label: 'Language & Zone', key: 'language' as Section },
  ];

  return (
    <div className="relative overflow-hidden bg-background-light dark:bg-background-dark min-h-screen text-gray-800 dark:text-gray-200">
      
      {/* Background Graphic Glows */}
      <div className="absolute inset-0 opacity-40 pointer-events-none">
        <div className="absolute top-10 right-10 w-96 h-96 bg-primary-650/5 dark:bg-primary-600/5 rounded-full filter blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-10 left-10 w-80 h-80 bg-blue-800/10 dark:bg-blue-800/5 rounded-full filter blur-[100px] animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="app-container relative z-10 py-12 max-w-5xl">
        
        {/* Main Glassmorphic Wrapper */}
        <div className="bg-white/70 dark:bg-gray-950/40 backdrop-blur-md rounded-2xl shadow-xl border border-gray-150 dark:border-gray-850 overflow-hidden flex flex-col md:flex-row min-h-[650px] animate-slide-up">
          
          {/* --- SIDEBAR PANEL --- */}
          <div className="w-full md:w-72 bg-gray-50/50 dark:bg-[#070707]/30 border-b md:border-b-0 md:border-r border-gray-250 dark:border-gray-850 p-8 flex flex-col items-center md:items-start">
            
            {/* Header Identity Display */}
            <div className="flex flex-col items-center md:items-start text-center md:text-left w-full">
              <div className="h-16 w-16 rounded-2xl bg-primary-600/10 text-primary-600 dark:text-primary-400 flex items-center justify-center mb-4 border border-primary-500/15 shadow-sm">
                <User size={32} />
              </div>
              <h3 className="text-lg font-extrabold text-gray-950 dark:text-white truncate max-w-full">
                {profile.firstName} {profile.lastName}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-8 truncate max-w-full">
                {profile.email}
              </p>
            </div>

            {/* Sidebar Navigation */}
            <nav className="w-full space-y-1.5">
              {sidebarItems.map((item) => {
                const active = section === item.key;
                return (
                  <button
                    key={item.label}
                    onClick={() => setSection(item.key)}
                    aria-current={active}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold transition-all ${
                      active 
                        ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/20' 
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100/50 dark:hover:bg-gray-900/30'
                    }`}
                  >
                    <item.icon size={16} />
                    <span className="flex-grow text-left">{item.label}</span>
                    {item.badge ? (
                      <span className="text-[10px] font-extrabold bg-red-500 text-white rounded-full h-5 min-w-[20px] flex items-center justify-center px-1 shadow-sm">
                        {item.badge}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </nav>

          </div>

          {/* --- CONTENT AREA PANEL --- */}
          <div className="flex-grow p-8 md:p-12 overflow-y-auto">

            {/* ── PROFILE DETAILS TAB ── */}
            {section === 'profile' && (
              <div className="space-y-8 animate-slide-up">
                <SectionHeader title="Profile Credentials" subtitle="Update your personal identification info, public details, and bios." />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Field label="First Name">
                    <input type="text" value={profile.firstName} onChange={(e) => updateField('firstName', e.target.value)} className={inputCls} />
                  </Field>
                  <Field label="Last Name">
                    <input type="text" value={profile.lastName} onChange={(e) => updateField('lastName', e.target.value)} className={inputCls} />
                  </Field>
                  <Field label="Email Address">
                    <input type="email" value={profile.email} readOnly className={readOnlyCls} />
                  </Field>
                  <Field label="Phone Contact">
                    <input type="text" value={profile.phone} onChange={(e) => updateField('phone', e.target.value)} className={inputCls} />
                  </Field>
                </div>
                <Field label="Professional Biography">
                  <textarea rows={3} value={profile.bio} onChange={(e) => updateField('bio', e.target.value)} className={`${inputCls} resize-none`} />
                </Field>
                
                <div className="pt-6 border-t border-gray-150 dark:border-gray-850 flex justify-end gap-4">
                  <button onClick={() => setProfile(StorageService.getProfile())} className="px-5 py-2.5 text-xs font-bold text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                    Discard Changes
                  </button>
                  <button 
                    onClick={handleSaveProfile} 
                    disabled={isSaving} 
                    className="px-6 py-2.5 bg-primary-600 text-white rounded-xl text-xs font-bold hover:shadow-lg hover:shadow-primary-500/20 active:scale-95 transition-all disabled:opacity-70 flex items-center gap-2"
                  >
                    {isSaving ? (
                      <>
                        <RefreshCcw size={14} className="animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : 'Save Updates'}
                  </button>
                </div>
              </div>
            )}

            {/* ── SECURITY TAB ── */}
            {section === 'security' && (
              <div className="space-y-8 max-w-xl animate-slide-up">
                <SectionHeader title="Security Controls" subtitle="Manage sign-in credentials, multi-factor triggers, and audit active sessions." />

                {/* Change Password Form */}
                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Key size={16} className="text-primary-600" />
                    Modify Account Password
                  </h4>

                  {(['current', 'newPw', 'confirm'] as const).map((field) => {
                    const labels = { current: 'Verify Current Password', newPw: 'Enter New Password', confirm: 'Confirm New Password' };
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
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-650"
                          aria-label={showPw[field] ? 'Hide password' : 'Show password'}
                        >
                          {showPw[field] ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    );
                  })}

                  <p className="text-[10px] text-gray-400 dark:text-gray-500">
                    Must be at least 8 characters long, featuring numbers, symbols, and uppercase variables.
                  </p>

                  <button
                    onClick={handleChangePassword}
                    disabled={changingPw}
                    className="px-5 py-2.5 bg-primary-600 text-white rounded-xl text-xs font-bold hover:shadow-lg hover:shadow-primary-500/20 active:scale-95 transition-all disabled:opacity-75 flex items-center gap-2"
                  >
                    {changingPw ? (
                      <>
                        <RefreshCcw size={14} className="animate-spin" />
                        <span>Updating...</span>
                      </>
                    ) : 'Update Password'}
                  </button>
                </div>

                {/* 2FA Toggle */}
                <div className="border-t border-gray-150 dark:border-gray-850 pt-8 space-y-4">
                  <div>
                    <h4 className="text-sm font-bold text-gray-900 dark:text-white">Two-Factor Authentication</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Strengthen access layers with TOTP tokens generated by secure authenticator apps.
                    </p>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-50/50 dark:bg-gray-950/20 rounded-xl border border-gray-200 dark:border-gray-800">
                    <div className="flex items-center gap-3">
                      <div className={`h-9 w-9 rounded-xl flex items-center justify-center border ${
                        twoFa ? 'bg-green-500/10 border-green-500/20 text-green-500' : 'bg-gray-100 dark:bg-gray-800 border-transparent text-gray-400'
                      }`}>
                        <Shield size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900 dark:text-white">App Authentication</p>
                        <p className="text-xs text-gray-550 dark:text-gray-400">{twoFa ? 'Protected — active' : 'Not configured'}</p>
                      </div>
                    </div>
                    <Toggle checked={twoFa} onChange={() => { setTwoFa(!twoFa); showToast(twoFa ? '2FA disabled.' : '2FA activated successfully!', twoFa ? 'info' : 'success'); }} label="Toggle 2FA app verification" />
                  </div>
                </div>

                {/* Sessions List */}
                <div className="border-t border-gray-150 dark:border-gray-850 pt-8 space-y-4">
                  <div>
                    <h4 className="text-sm font-bold text-gray-900 dark:text-white">Authorized Login Sessions</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Inspect and manage active workspace visibility channels.</p>
                  </div>

                  {[
                    { device: 'Chrome on Windows', location: 'Vadodara, India', time: 'Active now', current: true, icon: Monitor },
                    { device: 'Safari on iPhone 15', location: 'Mumbai, India', time: '2 days ago', current: false, icon: Smartphone },
                  ].map((session) => (
                    <div key={session.device} className="flex items-center justify-between p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white/40 dark:bg-gray-950/10 hover:shadow-sm transition-all">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-lg bg-gray-105 dark:bg-gray-850 border border-gray-200 dark:border-gray-800 text-gray-400">
                          <session.icon size={16} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-850 dark:text-gray-200">{session.device}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{session.location} · {session.time}</p>
                        </div>
                      </div>
                      {session.current ? (
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-primary-600/10 text-primary border border-primary/20">Current Node</span>
                      ) : (
                        <button 
                          className="text-[10px] font-bold text-red-500 hover:text-red-750 hover:bg-red-500/10 px-2.5 py-1.5 rounded-lg transition-colors border border-transparent hover:border-red-500/20" 
                          onClick={() => showToast('Session revoked successfully.', 'info')}
                        >
                          Revoke
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
   )}
            {/* ── NOTIFICATIONS PREFERENCES TAB ── */}
            {section === 'notifications' && (
              <div className="space-y-8 max-w-2xl animate-slide-up">
                <SectionHeader title="Alert Filters" subtitle="Configure notification vectors for secure compliance audits, document actions, and security reviews." />

                <div>
                  <h4 className="text-xs font-extrabold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-3">Email Notification Channels</h4>
                  
                  <div className="divide-y divide-gray-150 dark:divide-gray-850 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm">
                    {([
                      { key: 'documents' as const, title: 'Document analysis pipelines', desc: 'Get updates on completed AI contract audits, risk scores, and summary generations.' },
                      { key: 'security' as const, title: 'Security audit events', desc: 'Alerts regarding logins, profile edits, session activations, and key additions.' },
                      { key: 'marketing' as const, title: 'Product intelligence digests', desc: 'Brief highlights of new legal parsing models, features, and platform updates.' },
                    ]).map(({ key, title, desc }) => (
                      <div key={key} className="flex items-center justify-between px-5 py-4 bg-white/40 dark:bg-gray-900/30">
                        <div className="pr-4">
                          <p className="text-sm font-bold text-gray-800 dark:text-gray-200">{title}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-450 mt-1">{desc}</p>
                        </div>
                        <Toggle checked={profile.preferences.notifications[key]} onChange={() => updateNotificationPref(key)} label={`Toggle ${title}`} />
                      </div>
                    ))}
                  </div>
                </div>

                <button onClick={handleSaveNotifPrefs} className="px-6 py-2.5 bg-primary-600 text-white rounded-xl text-xs font-bold hover:shadow-lg hover:shadow-primary-500/20 active:scale-95 transition-all">
                  Save Notification Toggles
                </button>

                {/* Recent Notifications logs */}
                <div className="border-t border-gray-150 dark:border-gray-850 pt-8">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-xs font-extrabold uppercase tracking-widest text-gray-400 dark:text-gray-500">System Notifications Feed</h4>
                    {unreadCount > 0 && (
                      <button onClick={async () => { try { await markAllRead(); } catch { showToast('Failed to mark all as read', 'error'); } }} className="text-xs text-primary font-bold hover:underline">
                        Mark all read
                      </button>
                    )}
                  </div>

                  {notifications.length === 0 ? (
                    <div className="text-center py-12 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-xl">
                      <Bell size={24} className="mx-auto text-gray-300 dark:text-gray-650 mb-2 animate-bounce" />
                      <p className="text-sm font-semibold text-gray-400">Your notifications tray is clear</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-150 dark:divide-gray-850 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden bg-white/20 dark:bg-gray-900/10">
                      {notifications.map((n) => {
                        const { cls, icon, label } = notifTypeLabel(n.type);
                        return (
                          <div key={n.id} className={`flex items-start gap-4 px-5 py-4 transition-colors ${!n.read ? 'bg-primary-600/5 dark:bg-primary-500/5' : 'bg-transparent'}`}>
                            <div className="mt-0.5 flex-shrink-0">
                              <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${cls}`}>
                                {icon}
                                {label}
                              </span>
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-bold leading-normal ${!n.read ? 'text-gray-950 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>{n.title}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-normal">{n.description}</p>
                              <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1.5">{timeAgo(n.timestamp)}</p>
                            </div>

                            <div className="flex items-center gap-2 flex-shrink-0">
                              {!n.read && (
                                <button onClick={() => markRead(n.id)} className="text-xs font-bold text-primary hover:underline">
                                  Mark read
                                </button>
                              )}
                              <button onClick={() => removeNotification(n.id)} className="p-1 text-gray-400 hover:text-red-500 transition-colors" aria-label="Remove notification">
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
            )}

            {/* ── LANGUAGE & REGION TAB ── */}
            {section === 'language' && (
              <div className="space-y-8 max-w-2xl animate-slide-up">
                <SectionHeader title="Localization Profiles" subtitle="Select default interface display languages and align reporting time zones." />

                <div>
                  <h4 className="text-xs font-extrabold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-3">Display Interface Language</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {LANGUAGES.map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => setSelectedLang(lang.code)}
                        className={`flex items-center justify-between px-4 py-3.5 rounded-xl border text-left transition-all ${
                          selectedLang === lang.code 
                            ? 'border-primary bg-primary/5 dark:bg-primary/10 shadow-[0_0_15px_rgba(37,99,235,0.05)]' 
                            : 'border-gray-200 dark:border-gray-800 hover:border-primary/40 hover:bg-gray-50/50 dark:hover:bg-gray-900/20'
                        }`}
                      >
                        <div>
                          <p className={`text-sm font-bold ${selectedLang === lang.code ? 'text-primary' : 'text-gray-900 dark:text-gray-200'}`}>{lang.name}</p>
                          <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{lang.native}</p>
                        </div>
                        {selectedLang === lang.code && <Check size={16} className="text-primary flex-shrink-0" />}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="border-t border-gray-150 dark:border-gray-850 pt-8 space-y-4">
                  <h4 className="text-xs font-extrabold uppercase tracking-widest text-gray-400 dark:text-gray-500">Date Format & Timezones</h4>

                  <Field label="System Date Layout">
                    <select value={dateFormat} onChange={(e) => setDateFormat(e.target.value)} className={inputCls}>
                      {DATE_FORMATS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                    </select>
                  </Field>

                  <Field label="Audit Timestamp Timezone">
                    <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className={inputCls}>
                      {TIMEZONES.map((tz) => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
                    </select>
                  </Field>
                </div>

                <div className="pt-2 flex justify-end">
                  <button onClick={handleSaveLanguage} className="px-8 py-3 bg-primary-600 text-white rounded-xl text-xs font-bold hover:shadow-lg hover:shadow-primary-500/20 active:scale-95 transition-all">
                    Save regional layout
                  </button>
                </div>
              </div>
            )}

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
               className="px-8 py-2.5 bg-primary text-white rounded-xl font-bold hover:shadow-lg hover:shadow-primary/30 hover:scale-105 hover:-translate-y-0.5 active:scale-95 transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:translate-y-0 flex items-center gap-2"
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