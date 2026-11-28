import './index.css';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import { AcousticWeightingProvider } from './context/AcousticWeightingContext.tsx';

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

const rootEl = document.getElementById('root');

function renderFatalBootFallback(message: string) {
  if (!rootEl || rootEl.childElementCount > 0) return;
  const wrap = document.createElement('div');
  wrap.style.cssText =
    'min-height:100vh;background:#07090E;color:#f1f5f9;display:flex;align-items:center;justify-content:center;padding:24px;font-family:system-ui,-apple-system,sans-serif;';
  const card = document.createElement('div');
  card.style.cssText =
    'max-width:560px;width:100%;background:#111827;border:1px solid #334155;border-left:4px solid #f43f5e;border-radius:12px;padding:20px;';
  const title = document.createElement('h2');
  title.style.cssText = 'margin:0 0 8px 0;font-size:16px;font-weight:700;color:#ffffff;';
  title.textContent = 'Kritisk opstartsfejl i Ringparken Telemetry';
  const desc = document.createElement('p');
  desc.style.cssText = 'margin:0 0 12px 0;font-size:13px;color:#cbd5e1;line-height:1.5;';
  desc.textContent = message;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.style.cssText =
    'background:#059669;color:#ffffff;border:none;border-radius:8px;padding:8px 14px;font-size:12px;font-weight:700;cursor:pointer;';
  btn.textContent = 'Genindlæs applikationen';
  btn.onclick = () => window.location.reload();
  card.append(title, desc, btn);
  wrap.appendChild(card);
  rootEl.appendChild(wrap);
}

window.addEventListener('error', (event) => {
  if (rootEl && rootEl.childElementCount === 0) {
    renderFatalBootFallback(event.message || 'Ukendt JavaScript-opstartsfejl');
  }
});

window.addEventListener('unhandledrejection', (event) => {
  if (rootEl && rootEl.childElementCount === 0) {
    const reason = event.reason instanceof Error ? event.reason.message : String(event.reason);
    renderFatalBootFallback(reason || 'Ubehandlet asynkron opstartsfejl');
  }
});

if (rootEl) {
  try {
    createRoot(rootEl).render(
      <ErrorBoundary fallbackTitle="Kritisk Runtime-fejl i Ringparken Forensisk Applikation">
        <AcousticWeightingProvider>
          <App />
        </AcousticWeightingProvider>
      </ErrorBoundary>
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    renderFatalBootFallback(msg);
  }
}
