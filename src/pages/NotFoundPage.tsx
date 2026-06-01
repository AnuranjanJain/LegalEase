import { Link } from "react-router-dom";
import { ShieldAlert, Home, ArrowLeft } from "lucide-react";

export function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark px-6 py-12">
      <div className="text-center max-w-md w-full border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-8 rounded-2xl shadow-xl transition-all">
        <div className="flex justify-center mb-6">
          <div className="p-4 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 rounded-full animate-pulse">
            <ShieldAlert size={48} />
          </div>
        </div>

        <h1 className="text-7xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-2">
          404
        </h1>

        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-4">
          Case File Not Found
        </h2>

        <p className="text-gray-500 dark:text-gray-400 text-sm mb-8 leading-relaxed">
          The legal document, dashboard path, or page you are looking for does
          not exist or has been moved to another jurisdiction.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-900 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <ArrowLeft size={16} />
            Go Back
          </button>

          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 rounded-lg transition-colors shadow-sm"
          >
            <Home size={16} />
            Return Home
          </Link>
        </div>
      </div>
    </div>
  );
}
