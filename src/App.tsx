import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Layout } from './layouts/Layout';
import { HomePage } from './pages/HomePage';
import { DashboardPage } from './pages/DashboardPage';
import { DocumentsPage } from './pages/DocumentsPage';
import { ChatbotPage } from './pages/ChatbotPage';
import { ProfilePage } from './pages/ProfilePage';
import { DocumentationPage } from './pages/DocumentationPage';
import { ProcessingPage } from './pages/ProcessingPage';
import { SettingsPage } from './pages/SettingsPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { TermsPage } from './pages/TermsPage';
import { SecurityPage } from './pages/SecurityPage';
import { SimulationRoom } from './pages/SimulationRoom';
import { StorageService } from './services/storage';
import { NotFoundPage } from "./pages/NotFoundPage";
import { ScrollToTop } from './components/ScrollToTop';

import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/Login';
import { SignupPage } from './pages/Signup';
import { VerifyEmailPage } from './pages/VerifyEmail';
import BackToTop from "./components/BackToTop";

function App() {
  useEffect(() => {
    StorageService.initSampleData();
    StorageService.getProfile();
  }, []);

  return (
    <Router>
      <ScrollToTop />
      <BackToTop />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="documents" element={<ProtectedRoute><DocumentsPage /></ProtectedRoute>} />
          <Route path="documentation" element={<DocumentationPage />} />
          <Route path="simulation" element={<ProtectedRoute><SimulationRoom /></ProtectedRoute>} />
          <Route path="processing" element={<ProtectedRoute><ProcessingPage /></ProtectedRoute>} />
          <Route path="chatbot" element={<ProtectedRoute><ChatbotPage /></ProtectedRoute>} />
          <Route path="profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="profile/:tab" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
          <Route path="privacy" element={<PrivacyPage />} />
          <Route path="terms" element={<TermsPage />} />
          <Route path="security" element={<SecurityPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Router>
  );
}

export default App; 