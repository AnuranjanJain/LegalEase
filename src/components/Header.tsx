import { useState, useRef, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { Menu, X, Bell, Moon, Sun, User, Settings, LogOut, Sparkles } from 'lucide-react';
import { useDarkMode } from '../hooks/useDarkMode';

export function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const { isDarkMode, toggleDarkMode } = useDarkMode();
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);

  const [notifications, setNotifications] = useState([
    { id: 1, title: 'Document Uploaded', description: 'Your legal document was uploaded successfully.' },
    { id: 2, title: 'Profile Updated', description: 'Your profile information has been updated.' }
  ]);

  const toggleNotificationMenu = () => setIsNotificationOpen(!isNotificationOpen);
  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);
  const toggleUserMenu = () => setIsUserMenuOpen(!isUserMenuOpen);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) setIsUserMenuOpen(false);
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) setIsNotificationOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navLinks = [
    { name: 'Home', path: '/' },
    { name: 'Dashboard', path: '/dashboard' },
    { name: 'Documents', path: '/documents' },
    { name: 'Chatbot', path: '/chatbot' },
  ];

  return (
    <>
      {/* Spacer to prevent content from hiding under the fixed floating header */}
      <div className="h-24 w-full bg-transparent"></div>

      <header className="fixed top-6 left-0 right-0 z-50 flex justify-center px-4 sm:px-6 pointer-events-none">
        {/* Floating Glass Pill */}
        <div className="pointer-events-auto w-full max-w-6xl h-16 rounded-full bg-white/70 dark:bg-[#030303]/60 backdrop-blur-2xl border border-gray-200/50 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.3)] flex items-center justify-between px-2 sm:px-4 transition-all duration-300">
          
          {/* Brand */}
          <div className="flex items-center pl-2">
            <NavLink to="/" className="flex items-center gap-2 group">
              <div className="w-8 h-8 rounded-full bg-blue-600/10 dark:bg-white/[0.05] border border-blue-600/20 dark:border-white/10 flex items-center justify-center text-blue-600 dark:text-white group-hover:scale-105 transition-all">
                <Sparkles className="w-4 h-4" />
              </div>
              <h1 className="text-lg font-medium tracking-tight text-gray-900 dark:text-white hidden sm:block">LegalEase</h1>
            </NavLink>
          </div>

          {/* Center Navigation (Pill inside Pill) */}
          <nav className="hidden md:flex items-center bg-gray-100/50 dark:bg-white/[0.03] rounded-full p-1 border border-transparent dark:border-white/5">
            {navLinks.map((link) => (
              <NavLink
                key={link.name}
                to={link.path}
                className={({ isActive }) =>
                  `px-5 py-1.5 rounded-full text-sm font-medium transition-all duration-300 ${
                    isActive 
                    ? 'bg-white dark:bg-white/10 text-blue-600 dark:text-white shadow-sm dark:shadow-none' 
                    : 'text-gray-500 dark:text-white/50 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200/50 dark:hover:bg-white/[0.02]'
                  }`
                }
              >
                {link.name}
              </NavLink>
            ))}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-1 sm:gap-2 pr-1">
            <button onClick={toggleDarkMode} className="p-2.5 rounded-full text-gray-500 dark:text-white/50 hover:bg-gray-100 dark:hover:bg-white/10 transition-all">
              {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            <div className="relative hidden sm:block" ref={notificationRef}>
              <button onClick={toggleNotificationMenu} className={`p-2.5 rounded-full transition-all ${isNotificationOpen ? 'bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-white' : 'text-gray-500 dark:text-white/50 hover:bg-gray-100 dark:hover:bg-white/10'}`}>
                <Bell size={18} />
                {notifications.length > 0 && <span className="absolute top-2 right-2.5 h-2 w-2 rounded-full bg-blue-500 border border-white dark:border-[#030303]"></span>}
              </button>
              {isNotificationOpen && (
                <div className="absolute right-0 mt-4 w-80 rounded-3xl bg-white/90 dark:bg-[#0a0a0a]/90 backdrop-blur-3xl border border-gray-100 dark:border-white/10 shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-top-4">
                   <div className="px-4 py-3 border-b border-gray-100 dark:border-white/5"><h3 className="text-sm font-medium text-gray-900 dark:text-white">Notifications</h3></div>
                   {/* Map notifications here... */}
                </div>
              )}
            </div>

            <div className="relative" ref={userMenuRef}>
              <button onClick={toggleUserMenu} className="flex items-center justify-center h-9 w-9 rounded-full bg-blue-600 text-white hover:shadow-[0_0_15px_rgba(59,130,246,0.5)] transition-all ml-1">
                <span className="text-sm font-medium">SW</span>
              </button>
              {isUserMenuOpen && (
                <div className="absolute right-0 mt-4 w-60 rounded-3xl bg-white/90 dark:bg-[#0a0a0a]/90 backdrop-blur-3xl border border-gray-100 dark:border-white/10 shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-top-4">
                  <div className="px-4 py-3 border-b border-gray-100 dark:border-white/5 mb-2">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">Sarah Wilson</p>
                    <p className="text-xs text-gray-500 dark:text-white/40">sarah.w@example.com</p>
                  </div>
                  <NavLink to="/profile" className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-600 dark:text-white/70 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors"><User size={16} /> Profile</NavLink>
                  <NavLink to="/settings" className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-600 dark:text-white/70 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors"><Settings size={16} /> Settings</NavLink>
                  <button className="flex items-center gap-3 w-full text-left px-4 py-2.5 mt-1 text-sm text-red-500 font-medium hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors"><LogOut size={16} /> Sign out</button>
                </div>
              )}
            </div>

            <button onClick={toggleMobileMenu} className="md:hidden p-2 ml-1 rounded-full text-gray-500 dark:text-white/50 hover:bg-gray-100 dark:hover:bg-white/10">
              {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </header>

      {/* Full Screen Glass Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-white/95 dark:bg-[#030303]/95 backdrop-blur-3xl animate-in fade-in flex flex-col items-center justify-center pt-20">
          {navLinks.map((link) => (
             <NavLink key={link.name} to={link.path} onClick={() => setIsMobileMenuOpen(false)} className="text-2xl font-medium text-gray-900 dark:text-white mb-6 hover:text-blue-600 transition-colors">
               {link.name}
             </NavLink>
          ))}
        </div>
      )}
    </>
  );
}