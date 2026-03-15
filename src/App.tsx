import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Login } from './components/Login';
import { ChatLayout } from './components/ChatLayout';
import { Toaster } from 'react-hot-toast';
import { WifiOff } from 'lucide-react';

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-[#f5f5f7]">
        <div className="w-8 h-8 border-4 border-gray-200 border-t-black rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <>
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 bg-red-500 text-white text-xs font-medium py-1.5 px-4 flex items-center justify-center gap-2 z-50 animate-in slide-in-from-top">
          <WifiOff className="w-3 h-3" />
          You are currently offline. Some features may be unavailable.
        </div>
      )}
      {user ? <ChatLayout /> : <Login />}
    </>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Toaster position="top-center" toastOptions={{ className: 'text-sm font-medium rounded-xl shadow-sm' }} />
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
}
