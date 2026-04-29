import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { getActiveBasePath } from './lib/base-path.ts'

const activeBasePath = getActiveBasePath();
const activeHomePath = activeBasePath || '/';

if (window.location.pathname !== activeHomePath) {
  document.body.classList.remove('lynx-booting');
}

createRoot(document.getElementById("root")!).render(<App />);
