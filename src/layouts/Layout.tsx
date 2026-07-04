import { Outlet, useNavigate } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { ToastContainer } from '../components/ToastContainer';
import { ComplianceModal } from '../components/ComplianceModal';

export function Layout() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col min-h-screen bg-background-light dark:bg-background-dark font-display text-gray-800 dark:text-gray-200">
      <Header />
      <main className="flex-grow">
        <Outlet />
      </main>

      <button
        type="button"
        onClick={() => navigate('/chatbot')}
        className="fixed bottom-6 right-6 z-50 inline-flex items-center gap-2 rounded-full bg-primary-600 px-4 py-3 text-sm font-semibold text-white shadow-2xl shadow-primary-500/20 transition hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-2"
        aria-label="Open chatbot"
      >
        <MessageCircle size={18} />
        Chatbot
      </button>

      <Footer />
      <ToastContainer />
      <ComplianceModal />
    </div>
  );
}
