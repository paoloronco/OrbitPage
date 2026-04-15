import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

if (window.location.pathname !== '/') {
  document.body.classList.remove('lynx-booting');
}

createRoot(document.getElementById("root")!).render(<App />);
