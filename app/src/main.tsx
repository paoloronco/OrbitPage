import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { getActiveBasePath } from './lib/base-path.ts'

const activeBasePath = getActiveBasePath();
const activeHomePath = activeBasePath || '/';

if (window.location.pathname !== activeHomePath) {
  if (window.__ORBITPAGE_BOOT_READY__) {
    window.__ORBITPAGE_BOOT_READY__();
  } else {
    document.body.classList.remove('orbitpage-booting');
  }
}

createRoot(document.getElementById("root")!).render(<App />);
