import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { registerServiceWorker } from './registerServiceWorker';
import './style.css';

// Normalize basename so React Router matches paths both with and without trailing slash
// e.g. '/pocket-mc-telemetry/' -> '/pocket-mc-telemetry'
const rawBase = import.meta.env.BASE_URL || '/';
const appBasename = rawBase.length > 1 && rawBase.endsWith('/') ? rawBase.slice(0, -1) : rawBase;

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <BrowserRouter basename={appBasename}>
        <App />
      </BrowserRouter>
    </React.StrictMode>
  );
}

// Register Progressive Web App Service Worker
registerServiceWorker();
