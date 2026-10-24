import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { isExtension } from './lib/backend';
import { googleBackend } from './lib/google';
import { mockBackend } from './lib/mock';
import './index.css';

// Inside the installed extension, talk to Google; under `npm run dev` in a
// normal tab there is no chrome.identity, so use sample data instead.
const backend = isExtension() ? googleBackend : mockBackend;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App backend={backend} />
  </StrictMode>,
);
