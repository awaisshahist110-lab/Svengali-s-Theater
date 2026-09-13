import { createRoot } from 'react-dom/client';
import Theatre from '../app/theatre-client';
import siteConfig from '../site.config.json';
import '../app/theatre.css';

const base = import.meta.env.BASE_URL.replace(/\/$/, '');

// The API origin is baked in at build time. Change it with
// `npm run set-api-origin -- <url>`, which also rebuilds this bundle.
globalThis.__SVENGALI_HOSTING__ = {
  apiOrigin: (import.meta.env.VITE_API_ORIGIN || siteConfig.apiOrigin).replace(/\/+$/, ''),
  assetBase: base,
};
document.documentElement.style.setProperty('--stage-backdrop', `url("${base}/backdrop.webp")`);
createRoot(document.getElementById('root')!).render(<Theatre />);
