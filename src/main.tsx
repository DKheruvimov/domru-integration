import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Redirect all API calls to the dedicated subdomain to bypass WAF, if configured
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
if (apiBaseUrl) {
  const originalFetch = window.fetch;
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === "string" && input.startsWith("/api/")) {
      input = apiBaseUrl + input;
    } else if (input instanceof URL && input.pathname.startsWith("/api/")) {
      input = new URL(apiBaseUrl + input.pathname + input.search);
    }
    return originalFetch(input, init);
  };
}
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
