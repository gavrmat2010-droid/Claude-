import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

// No StrictMode: drei's <Html> creates its own React roots and StrictMode's
// double-invoked effects make it unmount them synchronously mid-render (dev-only errors).
createRoot(document.getElementById('root')!).render(<App />);
