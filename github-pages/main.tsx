import { createRoot } from 'react-dom/client';
import Theatre from '../app/theatre-client';
import '../app/theatre.css';

const base = import.meta.env.BASE_URL.replace(/\/$/, '');
globalThis.__SVENGALI_HOSTING__ = {
  apiOrigin: import.meta.env.VITE_API_ORIGIN || 'https://svengalis-theatre.awaisshah-ist110.chatgpt.site',
  assetBase: base,
};
document.documentElement.style.setProperty('--stage-backdrop', `url("${base}/backdrop.webp")`);
createRoot(document.getElementById('root')!).render(<Theatre />);
