import { NavLink } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 py-12">
      <div className="container mx-auto px-4 flex flex-col items-center">
        
        {/* Logo & Brand */}
        <div className="flex items-center gap-2 mb-6">
          <div className="text-primary">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
              <path d="M44 11.2727C44 14.0109 39.8386 16.3957 33.69 17.6364C39.8386 18.877 44 21.2618 44 24C44 26.7382 39.8386 29.123 33.69 30.3636C39.8386 31.6043 44 33.9891 44 36.7273C44 40.7439 35.0457 44 24 44C12.9543 44 4 40.7439 4 36.7273C4 33.9891 8.16144 31.6043 14.31 30.3636C8.16144 29.123 4 26.7382 4 24C4 21.2618 8.16144 18.877 14.31 17.6364C8.16144 16.3957 4 14.0109 4 11.2727C4 7.25611 12.9543 4 24 4C35.0457 4 44 7.25611 44 11.2727Z" fill="currentColor"></path>
            </svg>
          </div>
          <span className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">LegalEase</span>
        </div>

        {/* Navigation Links */}
        <nav className="flex flex-wrap justify-center gap-x-8 gap-y-4 mb-8">
          <NavLink to="/dashboard" className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-primary transition-colors">Dashboard</NavLink>
          <NavLink to="/documents" className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-primary transition-colors">Documents</NavLink>
          <NavLink to="/chatbot" className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-primary transition-colors">Legal AI Chat</NavLink>
          <a href="#" className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-primary transition-colors">Documentation</a>
          <a href="#" className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-primary transition-colors">Help Center</a>
        </nav>

        {/* Social Icons */}
        <div className="flex space-x-6 mb-8">
          <a href="#" className="text-gray-400 hover:text-primary transition-colors" aria-label="Follow us on Twitter">
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"/></svg>
          </a>
          <a href="#" className="text-gray-400 hover:text-primary transition-colors" aria-label="Join our LinkedIn">
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
          </a>
        </div>

        {/* Copyright & Secondary Links */}
        <div className="flex flex-col md:flex-row items-center gap-4 text-xs text-gray-500 dark:text-gray-500">
          <p>&copy; {new Date().getFullYear()} LegalEase Inc. All rights reserved.</p>
          <div className="hidden md:block w-1 h-1 bg-gray-300 rounded-full dark:bg-gray-700"></div>
          <div className="flex gap-4">
            <a href="#" className="hover:text-primary transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-primary transition-colors">Terms of Service</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
