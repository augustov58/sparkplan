import React from 'react';
// @ts-ignore - react-dom/client types not installed
import { createRoot } from 'react-dom/client';
import App from './App';
import { AuthProvider } from './components/Auth/AuthProvider';
import { ProjectsProvider } from './hooks/useProjects';
import { ErrorBoundary } from './components/ErrorBoundary';

const root = createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary
      onError={(error, errorInfo) => {
        // In production, send to error tracking service (e.g., Sentry)
        console.error('Application Error:', error, errorInfo);
      }}
    >
      <AuthProvider>
        <ProjectsProvider>
          <App />
        </ProjectsProvider>
      </AuthProvider>
    </ErrorBoundary>
  </React.StrictMode>
);