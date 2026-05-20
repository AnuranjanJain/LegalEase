import { NavLink } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="relative bg-gray-50 dark:bg-[#030303] border-t border-gray-200 dark:border-white/5 overflow-hidden transition-colors duration-300">
      
      {/* Background Graphic Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.03)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px] pointer-events-none"></div>
      
      {/* Bottom Glow */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[80%] h-[200px] bg-blue-600/10 dark:bg-blue-500/20 blur-[150px] pointer-events-none rounded-full"></div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8 pt-24 pb-12">
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-16 mb-24">
          {/* Massive Branding Area */}
          <div>
            <h2 className="text-4xl md:text-6xl font-semibold tracking-tighter text-gray-900 dark:text-white mb-6">
              LegalEase.
            </h2>
            <p className="text-lg text-gray-500 dark:text-white/40 max-w-sm leading-relaxed">
              The intelligence layer for your legal documents. Secure, fast, and driven by AI.
            </p>
          </div>

          {/* Clean Navigation Columns */}
          <div className="flex gap-16 md:justify-end">
            <div className="flex flex-col gap-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-2">Platform</h3>
              <NavLink to="/dashboard" className="text-sm text-gray-500 dark:text-white/50 hover:text-blue-600 dark:hover:text-white transition-colors">Dashboard</NavLink>
              <NavLink to="/documents" className="text-sm text-gray-500 dark:text-white/50 hover:text-blue-600 dark:hover:text-white transition-colors">Documents</NavLink>
              <NavLink to="/chatbot" className="text-sm text-gray-500 dark:text-white/50 hover:text-blue-600 dark:hover:text-white transition-colors">AI Chatbot</NavLink>
            </div>
            <div className="flex flex-col gap-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-2">Legal</h3>
              <a href="#" className="text-sm text-gray-500 dark:text-white/50 hover:text-blue-600 dark:hover:text-white transition-colors">Privacy</a>
              <a href="#" className="text-sm text-gray-500 dark:text-white/50 hover:text-blue-600 dark:hover:text-white transition-colors">Terms</a>
              <a href="#" className="text-sm text-gray-500 dark:text-white/50 hover:text-blue-600 dark:hover:text-white transition-colors">Security</a>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="w-full h-px bg-gray-200 dark:bg-white/10 mb-8"></div>

        {/* Bottom Bar */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <p className="text-sm text-gray-400 dark:text-white/30">
            &copy; {new Date().getFullYear()} LegalEase Inc. All rights reserved.
          </p>
          
          <div className="flex space-x-6">
            <a href="#" className="text-gray-400 dark:text-white/30 hover:text-gray-900 dark:hover:text-white transition-colors">
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"/></svg>
            </a>
            <a href="#" className="text-gray-400 dark:text-white/30 hover:text-gray-900 dark:hover:text-white transition-colors">
               <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}