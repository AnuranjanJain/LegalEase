import { Outlet } from 'react-router-dom';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';

export function Layout() {
  return (
    <div className="flex flex-col min-h-screen bg-background-light dark:bg-background-dark font-display text-gray-800 dark:text-gray-200">
      <Header />
      <main className="flex-grow">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
