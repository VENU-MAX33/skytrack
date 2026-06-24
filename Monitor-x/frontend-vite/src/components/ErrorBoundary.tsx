import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled render error:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-[#F5F6FA] flex items-center justify-center p-4">
          <div className="dashboard-card p-6 max-w-[420px] text-center">
            <h2 className="text-[16px] font-semibold text-[#222222] mb-2">Something went wrong</h2>
            <p className="text-[13px] text-[#777777] mb-4">{this.state.error.message}</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-[#0047B2] text-white text-[13px] px-4 py-2 rounded hover:bg-[#003a91]"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
