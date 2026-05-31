import { NavLink } from 'react-router-dom';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `text-sm transition-colors duration-200 whitespace-nowrap ${
    isActive
      ? 'text-blue-600 dark:text-blue-400 font-medium'
      : 'text-gray-500 dark:text-white/50 hover:text-blue-600 dark:hover:text-white'
  }`;

  const ComingSoonIcon = ({ children }: { children: React.ReactNode }) => (
  <div className="relative group">
    {children}
    <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 text-xs rounded bg-gray-900 dark:bg-white text-white dark:text-gray-900 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
      Coming soon
    </span>
  </div>
);

export function Footer() {
  return (
    <footer className="relative bg-gray-50 dark:bg-[#030303] border-t border-gray-200 dark:border-white/5 overflow-hidden transition-colors duration-300">
      {/* Background Graphic Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.03)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px] pointer-events-none" />

      {/* Bottom Glow */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[80%] h-[200px] bg-blue-600/10 dark:bg-blue-500/20 blur-[150px] pointer-events-none rounded-full" />

      <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8 pt-24 pb-12">
        {/* Main grid: branding left, nav columns right */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-12 mb-20">
          {/* Branding — spans 2 of 4 cols on large screens */}
          <div className="lg:col-span-2">
            <h2 className="text-4xl md:text-5xl font-semibold tracking-tighter text-gray-900 dark:text-white mb-4">
              LegalEase.
            </h2>
            <p className="text-base text-gray-500 dark:text-white/40 max-w-sm leading-relaxed">
              The intelligence layer for your legal documents. Secure, fast, and
              driven by AI.
            </p>
          </div>

          {/* Platform links */}
          <div className="flex flex-col gap-3">
            <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-widest mb-1">
              Platform
            </h3>
            <NavLink to="/dashboard" className={linkClass}>
              Dashboard
            </NavLink>
            <NavLink to="/documents" className={linkClass}>
              Documents
            </NavLink>
            <NavLink to="/chatbot" className={linkClass}>
              AI Chatbot
            </NavLink>
          </div>

          {/* Legal links */}
          <div className="flex flex-col gap-3">
            <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-widest mb-1">
              Legal
            </h3>
            <NavLink to="/privacy" className={linkClass}>
              Privacy Policy
            </NavLink>
            <NavLink to="/terms" className={linkClass}>
              Terms of Service
            </NavLink>
            <NavLink to="/security" className={linkClass}>
              Security
            </NavLink>
          </div>
        </div>

        {/* Divider */}
        <div className="w-full h-px bg-gray-200 dark:bg-white/10 mb-8" />

        {/* Bottom Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-sm text-gray-400 dark:text-white/30">
            &copy; {new Date().getFullYear()} LegalEase Inc. All rights
            reserved.
          </p>

          <div className="flex items-center space-x-5">
  <ComingSoonIcon>
    <a href="#" onClick={(e) => e.preventDefault()} aria-label="X"
      className="text-gray-400 dark:text-white/30 hover:text-gray-900 dark:hover:text-white transition-colors cursor-not-allowed">
      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    </a>
  </ComingSoonIcon>

  <ComingSoonIcon>
    <a href="#" onClick={(e) => e.preventDefault()} aria-label="LinkedIn"
      className="text-gray-400 dark:text-white/30 hover:text-gray-900 dark:hover:text-white transition-colors cursor-not-allowed">
      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
      </svg>
    </a>
  </ComingSoonIcon>
</div>
        </div>
      </div>
    </footer>
  );
}
