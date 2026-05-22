import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { ToastProvider } from './contexts/ToastContext.tsx'
import { NotificationProvider } from './contexts/NotificationContext.tsx'
import { AuthProvider } from './contexts/AuthContext.tsx'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <NotificationProvider>
        <ToastProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ToastProvider>
      </NotificationProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)
