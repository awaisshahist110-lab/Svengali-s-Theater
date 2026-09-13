import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { writeFileSync } from 'node:fs';
import siteConfig from './site.config.json';

const apiOrigin = process.env.VITE_API_ORIGIN || siteConfig.apiOrigin;

export default defineConfig({
  base: '/Svengali-s-Theater/',
  plugins: [react(), {
    name: 'github-pages-nojekyll',
    closeBundle() {
      writeFileSync('docs/.nojekyll', '');
      if (/chatgpt\.site$/i.test(new URL(apiOrigin).hostname)) {
        console.warn(
          '\n  Note: multiplayer still points at the ChatGPT-hosted API\n' +
          `    ${apiOrigin}\n` +
          '  Deploy your own with `npm run deploy:api`, then run\n' +
          '  `npm run set-api-origin -- <your-worker-url>` to switch over.\n',
        );
      }
    },
  }],
  build: { outDir: 'docs', emptyOutDir: true },
});
