import { useState, useRef, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { Menu, X, Bell, Moon, Sun, User, Settings } from 'lucide-react';
import { useDarkMode } from '../hooks/useDarkMode';

export function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const { isDarkMode, toggleDarkMode } = useDarkMode();
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);

  const toggleNotificationMenu = () =>
  setIsNotificationOpen(!isNotificationOpen);

  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);
  const toggleUserMenu = () => setIsUserMenuOpen(!isUserMenuOpen);

  // Close user menu on outside click
  useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(event.target as Node)
      ) {
        setIsUserMenuOpen(false);
      }

      if (
        notificationRef.current &&
        !notificationRef.current.contains(event.target as Node)
      ) {
        setIsNotificationOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const navLinks = [
    { name: 'Home', path: '/' },
    { name: 'Dashboard', path: '/dashboard' },
    { name: 'Documents', path: '/documents' },
    { name: 'Documentation', path: '/documentation' },
    { name: 'Chatbot', path: '/chatbot' },
    { name: 'Profile', path: '/profile' },
  ];

  return (
    <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-50">
      <div className="app-container">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-4">
            <NavLink to="/" className="flex items-center gap-2 group">
              <div className="text-primary transition-transform group-hover:scale-105">
                <svg className="h-8 w-8" fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                  <path d="M44 11.2727C44 14.0109 39.8386 16.3957 33.69 17.6364C39.8386 18.877 44 21.2618 44 24C44 26.7382 39.8386 29.123 33.69 30.3636C39.8386 31.6043 44 33.9891 44 36.7273C44 40.7439 35.0457 44 24 44C12.9543 44 4 40.7439 4 36.7273C4 33.9891 8.16144 31.6043 14.31 30.3636C8.16144 29.123 4 26.7382 4 24C4 21.2618 8.16144 18.877 14.31 17.6364C8.16144 16.3957 4 14.0109 4 11.2727C4 7.25611 12.9543 4 24 4C35.0457 4 44 7.25611 44 11.2727Z" fill="currentColor"></path>
                </svg>
              </div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">LegalEase</h1>
            </NavLink>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            {navLinks.map((link) => (
              <NavLink
                key={link.name}
                to={link.path}
                className={({ isActive }) =>
                  `text-sm font-medium transition-colors ${isActive ? 'text-primary' : 'text-gray-600 dark:text-gray-300 hover:text-primary dark:hover:text-primary'
                  }`
                }
              >
                {link.name}
              </NavLink>
            ))}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label="Toggle dark mode"
            >
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            <div className="relative hidden sm:flex" ref={notificationRef}>
  <button
    onClick={toggleNotificationMenu}
    className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary relative"
    aria-label="View notifications"
  >
    <Bell size={20} />

    {/* Notification Dot */}
    <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500"></span>
  </button>

  {/* Notification Dropdown */}
  {isNotificationOpen && (
    <div className="absolute right-0 mt-12 w-80 rounded-xl shadow-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 z-50 animate-slide-up overflow-hidden">
      
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          Notifications
        </h3>
      </div>

        {/* Notifications */}
        <div className="max-h-96 overflow-y-auto">

          <div className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-b border-gray-100 dark:border-gray-700">
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
              Document Uploaded
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Your legal document was uploaded successfully.
            </p>
          </div>

          <div className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-b border-gray-100 dark:border-gray-700">
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
              Profile Updated
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Your profile information has been updated.
            </p>
          </div>

          <div className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
              Welcome to LegalEase
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Explore dashboard features and documentation.
            </p>
          </div>

        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-700 text-center">
          <button
            className="text-sm text-primary hover:underline"
            onClick={() => setIsNotificationOpen(false)}
          >
            Mark all as read
          </button>
        </div>
      </div>
    )}
  </div>

            {/* Mobile Menu Button */}
            <button
              onClick={toggleMobileMenu}
              className="flex md:hidden p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-expanded={isMobileMenuOpen}
              aria-label="Open main menu"
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>

            {/* Profile Dropdown Container */}
            <div className="relative ml-2" ref={userMenuRef}>
              <button
                onClick={toggleUserMenu}
                className="flex items-center justify-center h-9 w-9 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-primary hover:bg-primary/10 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                aria-haspopup="true"
                aria-expanded={isUserMenuOpen}
                aria-label="Open user profile menu"
              >
                <User size={20} />
              </button>

              {/* Dropdown (Hidden by default) */}
              {isUserMenuOpen && (
                <div className="absolute right-0 mt-3 w-64 rounded-xl shadow-xl py-3 bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 focus:outline-none z-50 animate-slide-up origin-top-right border border-gray-100 dark:border-gray-700">
                  <div className="px-4 py-3 border-b border-gray-50 dark:border-gray-700 mb-2">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">Sarah Wilson</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">sarah.w@example.com</p>
                  </div>
                  <NavLink to="/profile" className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-primary transition-colors" onClick={() => setIsUserMenuOpen(false)}>
                    <User size={18} />
                    <span>Your Profile</span>
                  </NavLink>
                  <a href="#" className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-primary transition-colors" onClick={() => setIsUserMenuOpen(false)}>
                    <Settings size={18} />
                    <span>Settings</span>
                  </a>
                  <div className="px-2 mt-2 pt-2 border-t border-gray-50 dark:border-gray-700">
                    <button className="flex items-center gap-3 w-full text-left px-2 py-2.5 text-sm text-red-500 font-medium hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-colors" onClick={() => setIsUserMenuOpen(false)}>
                      <X size={18} />
                      <span>Sign out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>


        {/* Mobile Backdrop Overlay */}
        <div
          className={`fixed top-16 left-0 w-full h-[calc(100vh-4rem)] z-40 bg-black/10 backdrop-blur-[2px] transition-all duration-300 md:hidden ${isMobileMenuOpen
            ? 'opacity-100 visible'
            : 'opacity-0 invisible'
            }`}
          onClick={() => setIsMobileMenuOpen(false)}
        />

        {/* Mobile menu */}

        <div
          className={`absolute top-16 left-0 w-full md:hidden z-50 overflow-hidden transition-all duration-300 ease-in-out border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-lg ${isMobileMenuOpen
            ? 'max-h-96 opacity-100 py-3'
            : 'max-h-0 opacity-0 py-0'
            }`}
        >
          <div className="flex flex-col space-y-1 px-1">
            {navLinks.map((link, index) => (
              <NavLink
                key={link.name}
                to={link.path}
                className={({ isActive }) =>
                  `block px-3 py-2 rounded-md text-base font-medium transform transition-all duration-300 ${isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
                  } ${isMobileMenuOpen
                    ? 'translate-y-0 opacity-100'
                    : '-translate-y-2 opacity-0'
                  }`
                }
                style={{
                  transitionDelay: `${index * 50}ms`,
                }}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {link.name}
              </NavLink>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}
