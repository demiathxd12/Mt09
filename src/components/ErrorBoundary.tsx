import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 max-w-lg w-full">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Something went wrong</h2>
            <div className="bg-red-50 text-red-800 p-4 rounded-xl text-sm font-mono overflow-auto max-h-64">
              {this.state.error?.message}
            </div>
            <button
              className="mt-6 px-4 py-2 bg-black text-white rounded-xl font-medium hover:bg-gray-800 transition-colors"
              onClick={() => window.location.reload()}
            >
              Reload application
            </button>
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}
