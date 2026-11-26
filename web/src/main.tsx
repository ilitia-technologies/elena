import {injectBasicCatalogStyles} from '@a2ui/web_core/v1_0';
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {App} from './App';
import {startTelemetry} from './telemetry';
import './styles.css';

injectBasicCatalogStyles();
void startTelemetry();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
