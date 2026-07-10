import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Removed fetch interceptor: HTTP API requests will remain same-origin (going through Turboflare/Cloudflare)
// to avoid triggering cross-origin OPTIONS preflights that cause the Cloud.ru WAF to ban the IP.
// WebSockets (socket.ts) will continue to explicitly use VITE_API_BASE_URL to bypass Turboflare.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
