import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import './index.css';

(window as unknown as Record<string, unknown>).gm_authFailure = () => {
  window.dispatchEvent(new CustomEvent('gmp-auth-failure'));
};

const origError = console.error;
console.error = (...args: unknown[]) => {
  const msg = args.map((a) => String(a)).join(' ');
  if (msg.includes('OverQuotaMapError') || msg.includes('QuotaExceededError')) {
    window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
    return;
  }
  if (
    msg.includes('ApiNotActivatedMapError') ||
    msg.includes('InvalidKeyMapError') ||
    msg.includes('MissingKeyMapError') ||
    msg.includes('RefererNotAllowedMapError') ||
    msg.includes('BillingNotEnabledMapError')
  ) {
    window.dispatchEvent(new CustomEvent('gmp-auth-failure'));
    return;
  }
  origError.apply(console, args);
};

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary fallbackTitle="Kritisk Runtime-fejl i Ringparken Forensisk Applikation">
    <App />
  </ErrorBoundary>
);

