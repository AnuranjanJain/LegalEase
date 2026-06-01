import { NavLink } from 'react-router-dom';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `text-sm transition-colors duration-200 whitespace-nowrap ${
    isActive
      ? 'text-blue-600 dark:text-blue-400 font-medium'
      : 'text-gray-500 dark:text-white/50 hover:text-blue-600 dark:hover:text-white'
  }`;

// New static link class for <a> tags to bypass React Router
const staticLinkClass = "text-sm text-gray-500 dark:text-white/50 hover:text-blue-600 dark:hover:text-white transition-colors duration-200 whitespace-nowrap";

export function Footer() {
  return (
    <footer className="relative bg-gray-50 dark:bg-[#030303] border-t border-gray-200 dark:border-white/5 overflow-hidden transition-colors duration-300">

      {/* Background Graphic Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.03)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px] pointer-events-none" />

      {/* Bottom Glow */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[80%] h-[200px] bg-blue-600/10 dark:bg-blue-500/20 blur-[150px] pointer-events-none rounded-full" />

      <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8 pt-24 pb-12">

        {/* Main grid: branding left, nav columns right */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-12 mb-20">

          {/* Branding & Newsletter — spans 2 of 5 cols on large screens */}
          <div className="lg:col-span-2">
            <h2 className="text-4xl md:text-5xl font-semibold tracking-tighter text-gray-900 dark:text-white mb-4">
              LegalEase.
            </h2>
            <p className="text-base text-gray-500 dark:text-white/40 max-w-sm leading-relaxed mb-6">
              The intelligence layer for your legal documents. Secure, fast, and driven by AI.
            </p>
            {/* Added Newsletter Form to pad lines and improve UI */}
            <form className="mt-4 sm:flex sm:max-w-md">
              <label htmlFor="email-address" className="sr-only">Email address</label>
              <input
                type="email"
                name="email-address"
                id="email-address"
                autoComplete="email"
                required
                className="w-full min-w-0 appearance-none rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800/50 px-4 py-2 text-base text-gray-900 dark:text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:text-sm"
                placeholder="Subscribe to our newsletter"
              />
              <div className="mt-3 rounded-md sm:mt-0 sm:ml-3 sm:flex-shrink-0">
                <button
                  type="submit"
                  className="flex w-full items-center justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:text-sm transition-colors"
                >
                  Subscribe
                </button>
              </div>
            </form>
          </div>

          {/* Platform links */}
          <div className="flex flex-col gap-3">
            <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-widest mb-1">
              Platform
            </h3>
            <NavLink to="/dashboard" className={linkClass}>Dashboard</NavLink>
            <NavLink to="/documents" className={linkClass}>Documents</NavLink>
            <NavLink to="/chatbot" className={linkClass}>AI Chatbot</NavLink>
            <NavLink to="/integrations" className={linkClass}>Integrations</NavLink>
          </div>

          {/* Resources links (New Column) */}
          <div className="flex flex-col gap-3">
            <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-widest mb-1">
              Resources
            </h3>
            <NavLink to="/guides" className={linkClass}>User Guides</NavLink>
            <NavLink to="/api" className={linkClass}>API Reference</NavLink>
            <NavLink to="/help" className={linkClass}>Help Center</NavLink>
            <NavLink to="/blog" className={linkClass}>Blog</NavLink>
          </div>

          {/* Legal links - FIX APPLIED HERE */}
          <div className="flex flex-col gap-3">
            <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-widest mb-1">
              Legal
            </h3>
            {/* Swapped NavLink for standard <a> tags to bypass React Router */}
            <a href="/privacy" className={staticLinkClass}>Privacy Policy</a>
            <a href="/terms" className={staticLinkClass}>Terms of Service</a>
            <a href="/security" className={staticLinkClass}>Security</a>
            <a href="/cookie-policy" className={staticLinkClass}>Cookie Policy</a>
          </div>

        </div>

        {/* Divider */}
        <div className="w-full h-px bg-gray-200 dark:bg-white/10 mb-8" />

        {/* Bottom Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-sm text-gray-400 dark:text-white/30">
            &copy; {new Date().getFullYear()} LegalEase Inc. All rights reserved.
          </p>

          <div className="flex items-center space-x-5">
            {/* X */}
            <a href="#" aria-label="X" className="text-gray-400 dark:text-white/30 hover:text-gray-900 dark:hover:text-white transition-colors">
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
            {/* LinkedIn */}
            <a href="#" aria-label="LinkedIn" className="text-gray-400 dark:text-white/30 hover:text-gray-900 dark:hover:text-white transition-colors">
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
              </svg>
            </a>
            {/* GitHub */}
            <a href="#" aria-label="GitHub" className="text-gray-400 dark:text-white/30 hover:text-gray-900 dark:hover:text-white transition-colors">
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
            </a>
          </div>
        </div>

      </div>
    </footer>
  );
}