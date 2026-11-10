import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Disable Edge/WebView2 context menu globally
window.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  return false;
});

// Disable browser accelerator keys (F3 search, F5 reload, F7 caret, Ctrl+F, Ctrl+R, etc.)
window.addEventListener('keydown', (e) => {
  const isBrowserKey =
    e.key === 'F3' ||
    e.key === 'F5' ||
    e.key === 'F7' ||
    ((e.ctrlKey || e.metaKey) && ['r', 'R', 'f', 'F', 'p', 'P', 'u', 'U', 'g', 'G'].includes(e.key));

  if (isBrowserKey) {
    e.preventDefault();
    e.stopPropagation();
  }
});

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Kotofy ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: 24,
            background: '#142347',
            color: '#fff',
            height: '100vh',
            fontFamily: 'monospace',
            overflow: 'auto',
          }}
        >
          <h2 style={{ color: '#ff6b6b', margin: '0 0 12px 0' }}>Runtime Error in Kotofy</h2>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13, background: 'rgba(0,0,0,0.3)', padding: 12, borderRadius: 8 }}>
            {this.state.error?.stack || this.state.error?.message}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 16,
              padding: '8px 16px',
              background: '#3b82f6',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
          >
            Reload Kotofy
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
