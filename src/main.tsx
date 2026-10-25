import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { isExtension } from './lib/backend';
import { applyTheme, loadSettings } from './lib/settings';
import { googleBackend } from './lib/google';
import { mockBackend } from './lib/mock';
import './index.css';

// Inside the installed extension, talk to Google; under `npm run dev` in a
// normal tab there is no chrome.identity, so use sample data instead.
const backend = isExtension() ? googleBackend : mockBackend;

// Before the first render, so a saved dark/light choice doesn't flash.
applyTheme(loadSettings());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App backend={backend} />
  </StrictMode>,
);
