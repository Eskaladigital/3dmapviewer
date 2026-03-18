import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; key: number }
> {
  state = { hasError: false, key: 0 }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          height: '100%', background: '#0f1117', color: '#c8cad8', fontFamily: 'system-ui', padding: 24,
        }}>
          <h2 style={{ marginBottom: 12 }}>Error al cargar</h2>
          <button
            onClick={() => this.setState({ hasError: false, key: this.state.key + 1 })}
            style={{ padding: '10px 24px', background: '#5B8DEF', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', fontSize: 14 }}
          >
            Reintentar
          </button>
        </div>
      )
    }
    return <React.Fragment key={this.state.key}>{this.props.children}</React.Fragment>
  }
}

// Global styles
const style = document.createElement('style')
style.textContent = `
  *, *::before, *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }
  html, body, #root {
    width: 100%;
    height: 100%;
    overflow: hidden;
    font-family: 'DM Sans', system-ui, sans-serif;
    transition: background 0.3s, color 0.3s;
  }
  body.theme-dark, body.theme-dark #root {
    background: #0f1117;
    color: #c8cad8;
  }
  body.theme-light, body.theme-light #root {
    background: #f0f2f5;
    color: #1a1a2e;
  }
  body.theme-dark ::-webkit-scrollbar-track { background: #13141c; }
  body.theme-dark ::-webkit-scrollbar-thumb { background: #2a2d3e; }
  body.theme-dark ::-webkit-scrollbar-thumb:hover { background: #3a3d5e; }
  body.theme-light ::-webkit-scrollbar-track { background: #f0f2f5; }
  body.theme-light ::-webkit-scrollbar-thumb { background: #c0c4cc; }
  body.theme-light ::-webkit-scrollbar-thumb:hover { background: #a0a4ac; }
  ::-webkit-scrollbar { width: 6px; }
  button {
    transition: all 0.15s ease;
  }
  button:hover {
    filter: brightness(1.15);
  }
  button:active {
    transform: scale(0.97);
  }
  button:disabled {
    opacity: 0.35;
    cursor: not-allowed;
    filter: none;
    transform: none;
  }
  input[type="range"] {
    height: 4px;
    border-radius: 2px;
    appearance: none;
    -webkit-appearance: none;
    outline: none;
    transition: background 0.15s;
  }
  body.theme-dark input[type="range"] { background: #2a2d3e; }
  body.theme-dark input[type="range"]:hover { background: #3a3d5e; }
  body.theme-light input[type="range"] { background: #d0d4dc; }
  body.theme-light input[type="range"]:hover { background: #b0b4bc; }
  input[type="range"]::-webkit-slider-thumb {
    appearance: none;
    -webkit-appearance: none;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #5B8DEF;
    cursor: pointer;
    transition: box-shadow 0.15s;
  }
  body.theme-dark input[type="range"]::-webkit-slider-thumb { border: 2px solid #13141c; }
  body.theme-light input[type="range"]::-webkit-slider-thumb { border: 2px solid #ffffff; }
  input[type="range"]::-webkit-slider-thumb:hover {
    box-shadow: 0 0 0 4px rgba(91,141,239,0.2);
  }
  input[type="color"] {
    cursor: pointer;
    border-radius: 6px;
    transition: border-color 0.15s;
  }
  body.theme-dark input[type="color"] { border: 1px solid #333; }
  body.theme-light input[type="color"] { border: 1px solid #ccc; }
  input[type="color"]:hover { border-color: #5B8DEF; }
  input[type="number"] { transition: border-color 0.15s; }
  input[type="number"]:focus { border-color: #5B8DEF !important; outline: none; }
  ::selection {
    background: rgba(91,141,239,0.3);
    color: #fff;
  }
  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes slideIn {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }
`
document.head.appendChild(style)
document.body.classList.add('theme-dark')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
)
