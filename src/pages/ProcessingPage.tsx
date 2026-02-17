import { RefreshCcw } from 'lucide-react';
import { NavLink } from 'react-router-dom';

export function ProcessingPage() {
  return (
    <div className="app-container py-12 flex flex-col items-center justify-center min-h-[60vh]">
      <div className="w-full max-w-2xl bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-8 space-y-8">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center rounded-full bg-primary/10 text-primary">
            <RefreshCcw size={32} className="animate-spin-slow" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Analyzing Your Document</h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Our AI is simplifying your legal document. This usually takes just a few moments.</p>
        </div>

        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-full bg-primary/10 text-primary">
              <RefreshCcw size={20} className="animate-spin-slow" />
            </div>
            <div className="flex-grow">
              <div className="flex justify-between items-center mb-1">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Analyzing Document Structure</p>
                <p className="text-sm font-medium text-primary">In Progress</p>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div className="bg-primary h-2 rounded-full transition-all duration-1000 w-3/4"></div>
              </div>
            </div>
          </div>

          {/* Steps... */}
        </div>

        <div className="flex gap-3 justify-center pt-8">
          <button className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            Cancel
          </button>
          <NavLink to="/documents" className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors">
            Upload Another
          </NavLink>
        </div>
      </div>
    </div>
  );
}
