import { Sun, Moon } from 'lucide-react';
import { useDarkMode } from '../hooks/useDarkMode';

export function ThemeToggleSwitch() {
  const { isDarkMode, toggleDarkMode } = useDarkMode();

  return (
    <button
      onClick={toggleDarkMode}
      role="switch"
      aria-checked={isDarkMode}
      aria-label={`Switch to ${isDarkMode ? 'light' : 'dark'} mode`}
      className={`relative w-14 h-7 rounded-full p-0.5 transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
        isDarkMode ? 'bg-gray-600' : 'bg-gray-300'
      }`}
    >
      <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-yellow-500 pointer-events-none">
        <Sun size={12} />
      </span>
      <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
        <Moon size={12} />
      </span>
      <span
        className={`block w-6 h-6 rounded-full bg-white shadow-md transition-transform duration-300 ${
          isDarkMode ? 'translate-x-7' : 'translate-x-0'
        }`}
      />
    </button>
  );
}
