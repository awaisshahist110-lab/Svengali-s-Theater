/**
 * Points the GitHub Pages build at a different multiplayer API.
 *
 *   npm run set-api-origin -- https://svengalis-theatre-api.<you>.workers.dev
 *
 * Writes site.config.json, then rebuilds docs/ so the published site picks the
 * new origin up on the next push.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const input = process.argv[2];

if (!input) {
  console.error('Usage: npm run set-api-origin -- <api-url>');
  console.error('Example: npm run set-api-origin -- https://svengalis-theatre-api.jane.workers.dev');
  process.exit(64);
}

let url;
try {
  url = new URL(input);
} catch {
  console.error(`Not a valid URL: ${input}`);
  process.exit(65);
}

if (url.protocol !== 'https:') {
  console.error('The API origin must use https:// so browsers can call it from GitHub Pages.');
  process.exit(65);
}

// Keep only the origin. A path here would corrupt every API request.
const apiOrigin = url.origin;

const config = JSON.parse(readFileSync('site.config.json', 'utf8'));
const previous = config.apiOrigin;
config.apiOrigin = apiOrigin;
writeFileSync('site.config.json', `${JSON.stringify(config, null, 2)}\n`);

console.log(`API origin: ${previous}\n         -> ${apiOrigin}`);
console.log('\nRebuilding the GitHub Pages bundle...');
execFileSync('npm', ['run', 'build:pages'], { stdio: 'inherit' });

console.log('\nDone. Commit and push to publish:');
console.log('  git add site.config.json docs');
console.log('  git commit -m "Point multiplayer at the self-hosted API"');
console.log('  git push');
