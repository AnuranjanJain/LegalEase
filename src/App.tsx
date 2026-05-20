import { useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Layout } from "./layouts/Layout";
import { HomePage } from "./pages/HomePage";
import { DashboardPage } from "./pages/DashboardPage";
import { DocumentsPage } from "./pages/DocumentsPage";
import { ChatbotPage } from "./pages/ChatbotPage";
import { ProfilePage } from "./pages/ProfilePage";
import { DocumentationPage } from "./pages/DocumentationPage";
import { ProcessingPage } from "./pages/ProcessingPage";
import { StorageService } from "./services/storage";
import { NotFoundPage } from "./pages/NotFoundPage";

function App() {
  useEffect(() => {
    StorageService.initSampleData();
    StorageService.getProfile(); // Init sample profile if not exists
  }, []);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="documents" element={<DocumentsPage />} />
          <Route path="documentation" element={<DocumentationPage />} />
          <Route path="processing" element={<ProcessingPage />} />
          <Route path="chatbot" element={<ChatbotPage />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Router>
  );
}

export default App;
