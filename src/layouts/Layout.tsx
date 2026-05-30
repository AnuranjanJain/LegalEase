import { NavLink, Outlet } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { ToastContainer } from '../components/ToastContainer';

export function Layout() {
  return (
    <div className="flex flex-col min-h-screen bg-background-light dark:bg-background-dark font-display text-gray-800 dark:text-gray-200">
      <Header />
      <main className="flex-grow">
        <Outlet />
      </main>
      <Footer />
      <ToastContainer />
      <NavLink
        to="/chatbot"
        className="fixed bottom-6 right-6 z-50 inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-2xl shadow-primary/30 hover:bg-primary/90 focus:outline-none focus:ring-4 focus:ring-primary/25 transition-all"
        aria-label="Open chatbot"
      >
        <MessageSquare size={24} />
      </NavLink>
    </div>
  );
}
