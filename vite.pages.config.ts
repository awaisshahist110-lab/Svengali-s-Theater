import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { writeFileSync } from 'node:fs';

export default defineConfig({
  base: '/Svengali-s-Theater/',
  plugins: [react(), {
    name: 'github-pages-nojekyll',
    closeBundle() { writeFileSync('docs/.nojekyll', ''); },
  }],
  build: { outDir: 'docs', emptyOutDir: true },
});
