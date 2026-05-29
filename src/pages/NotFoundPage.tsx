import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export function NotFoundPage() {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "404 - Page Not Found";
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
      <div className="text-sm text-gray-500 mb-6 tracking-wide">
        LegalEase
      </div>

      <h1 className="text-7xl font-bold text-gray-800">404</h1>

      <h2 className="text-xl font-medium text-gray-600 mt-3">
        Page Not Found
      </h2>

      <p className="text-gray-400 mt-2 text-center max-w-md">
        The page you are looking for doesn’t exist or may have been moved.
      </p>

      <div className="flex gap-4 mt-6">
        <button
          onClick={() => navigate("/")}
          className="px-6 py-3 bg-blue-600 text-white rounded-xl shadow-md hover:bg-blue-700 transition-all duration-200"
        >
          Back to Home
        </button>

        <button
          onClick={() => navigate(-1)}
          className="px-6 py-3 border border-gray-300 rounded-xl hover:bg-gray-100 transition-all duration-200"
        >
          Go Back
        </button>
      </div>
    </div>
  );
}