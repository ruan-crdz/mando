import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import '@fontsource/saira-condensed/latin-500.css';
import '@fontsource/saira-condensed/latin-600.css';
import '@fontsource/saira-condensed/latin-700.css';
import '@fontsource/saira-condensed/latin-800.css';
import '@fontsource/saira-semi-condensed/latin-400.css';
import '@fontsource/saira-semi-condensed/latin-500.css';
import '@fontsource/saira-semi-condensed/latin-600.css';
import './styles.css';

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: string | null }
> {
  state: { error: string | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }
  render() {
    if (this.state.error)
      return (
        <main className="fatal-error">
          <h1>O jogo encontrou um problema.</h1>
          <p role="alert">{this.state.error}</p>
          <p>Seu último save persistido continua no navegador. Recarregar não apaga a carreira.</p>
          <button onClick={() => location.reload()}>Reabrir Mando</button>
        </main>
      );
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
