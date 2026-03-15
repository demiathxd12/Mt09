import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { MessageSquare, AlertCircle, Loader2 } from 'lucide-react';

export const Login: React.FC = () => {
  const { signIn, loading, error } = useAuth();

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-[#f5f5f7] p-4 font-sans">
      <div className="bg-white p-10 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] max-w-md w-full text-center border border-gray-100">
        <div className="w-16 h-16 bg-black rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-sm">
          <MessageSquare className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-semibold text-gray-900 mb-3 tracking-tight">Welcome to Chat</h1>
        <p className="text-gray-500 mb-10 text-lg">Sign in to connect with your friends and colleagues.</p>
        
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-600 text-sm text-left animate-in fade-in slide-in-from-top-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <button
          onClick={signIn}
          disabled={loading}
          className={`w-full flex items-center justify-center gap-3 bg-black text-white py-4 px-6 rounded-2xl font-medium text-lg transition-all active:scale-[0.98] ${
            loading ? 'opacity-70 cursor-not-allowed' : 'hover:bg-gray-800'
          }`}
        >
          {loading ? (
            <>
              <Loader2 className="w-6 h-6 animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              <svg className="w-6 h-6" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continue with Google
            </>
          )}
        </button>

        <p className="mt-8 text-xs text-gray-400">
          By signing in, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
};
