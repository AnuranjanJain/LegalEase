import { ArrowRight, FileText, Shield, Zap } from 'lucide-react';
import { NavLink } from 'react-router-dom';

export function HomePage() {
  return (
    <>
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary/5 to-primary/10 py-20 px-4 sm:px-6 lg:px-8">
        <div className="app-container text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6">
            Simplify Your <span className="text-primary">Legal Documents</span>
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 mb-8 max-w-2xl mx-auto">
            Stop struggling with complex legal jargon. Our AI-powered platform analyzes, summarizes, and explains
            your contracts and agreements in seconds.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <NavLink
              to="/documents"
              className="inline-flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-primary hover:bg-primary/90 md:text-lg transition-colors"
            >
              Get Started
              <ArrowRight className="ml-2 h-5 w-5" />
            </NavLink>
            <NavLink
              to="/chatbot"
              className="inline-flex items-center justify-center px-8 py-3 border border-gray-300 dark:border-gray-700 text-base font-medium rounded-lg text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 md:text-lg transition-colors"
            >
              Try Chatbot
            </NavLink>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="app-container">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Why LegalEase?</h2>
            <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              We combine advanced artificial intelligence with legal expertise to make document processing effortless.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 rounded-2xl bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-shadow border border-gray-100 dark:border-gray-700">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4 text-primary">
                <FileText size={24} />
              </div>
              <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">Smart Analysis</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Instantly breaks down complex clauses into plain English summaries you can actually understand.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-shadow border border-gray-100 dark:border-gray-700">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4 text-primary">
                <Shield size={24} />
              </div>
              <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">Secure Processing</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Enterprise-grade encryption ensures your sensitive documents remain private and protected.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-shadow border border-gray-100 dark:border-gray-700">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4 text-primary">
                <Zap size={24} />
              </div>
              <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">Instant Results</h3>
              <p className="text-gray-600 dark:text-gray-400">
                No more waiting for legal reviews. Get immediate insights and answers to your questions.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
