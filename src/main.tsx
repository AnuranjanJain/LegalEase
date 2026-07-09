import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { ToastProvider } from './contexts/ToastContext.tsx'
import { NotificationProvider } from './contexts/NotificationContext.tsx'
import { RedactionProvider } from './contexts/RedactionContext.tsx'
import { AuthProvider } from './contexts/AuthContext.tsx'
import { ComplianceProvider } from './contexts/ComplianceContext.tsx'

// Global error handlers for uncaught exceptions and unhandled promise rejections
window.addEventListener('error', (event) => {
  console.error('Global uncaught error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Global unhandled promise rejection:', event.reason);
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <NotificationProvider>
          <ToastProvider>
            <RedactionProvider>
              <ComplianceProvider>
                <App />
              </ComplianceProvider>
            </RedactionProvider>
          </ToastProvider>
        </NotificationProvider>
      </AuthProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)