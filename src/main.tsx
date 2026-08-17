import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

class RootErrorBoundary extends React.Component<
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

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[Frontend Fatal Error]:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 32, color: '#ff7875', background: '#0f141c', height: '100vh', fontFamily: 'monospace' }}>
          <h2>⚠️ 页面加载异常 (Runtime Error)</h2>
          <pre style={{ background: 'rgba(255,255,255,0.05)', padding: 16, borderRadius: 8, color: '#f0f4f8', whiteSpace: 'pre-wrap', marginTop: 12 }}>
            {this.state.error?.stack || this.state.error?.message}
          </pre>
          <button
            style={{ marginTop: 16, padding: '8px 18px', background: '#d4af37', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 'bold' }}
            onClick={() => window.location.reload()}
          >
            刷新页面
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * 应用程序前端挂载入口
 * 启用 React.StrictMode 安全防护
 */
const rootElement = document.getElementById('root');

if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <RootErrorBoundary>
        <App />
      </RootErrorBoundary>
    </React.StrictMode>
  );
}
