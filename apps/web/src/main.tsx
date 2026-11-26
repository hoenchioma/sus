import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

// TV web views can predate structuredClone (Chromium 98); game states are plain JSON, so this is equivalent.
globalThis.structuredClone ??= <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
