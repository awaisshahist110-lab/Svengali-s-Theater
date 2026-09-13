#!/usr/bin/env bash
# Deploys the multiplayer API to your own Cloudflare account.
#
#   npm run deploy:api
#
# Creates the D1 database on first run, applies the schema migration, then
# publishes worker/api.ts. Safe to re-run: each step is skipped if already done.
set -euo pipefail

cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

wrangler="npx wrangler"
config="wrangler.jsonc"
placeholder="REPLACE_WITH_YOUR_D1_DATABASE_ID"
database_name="svengalis-theatre"

echo "==> Checking your Cloudflare login"
if ! $wrangler whoami >/dev/null 2>&1; then
  echo
  echo "You are not logged in to Cloudflare. Run:" >&2
  echo "    npx wrangler login" >&2
  echo
  echo "A free account is enough; this API fits inside the free Workers and D1 tiers." >&2
  exit 77
fi
$wrangler whoami 2>/dev/null | grep -i "account" || true

if grep -q "${placeholder}" "${config}"; then
  echo
  echo "==> Setting up the D1 database '${database_name}'"

  if ! $wrangler d1 list --json 2>/dev/null | grep -q "\"name\": *\"${database_name}\""; then
    echo "Creating it..."
    $wrangler d1 create "${database_name}"
  else
    echo "It already exists on your account; reusing it."
  fi

  database_id="$(
    $wrangler d1 list --json 2>/dev/null |
      node -e '
        let raw = "";
        process.stdin.on("data", chunk => { raw += chunk; });
        process.stdin.on("end", () => {
          const wanted = process.argv[1];
          const match = JSON.parse(raw).find(db => db.name === wanted);
          if (!match) { console.error(`Could not find the database ${wanted}.`); process.exit(1); }
          process.stdout.write(match.uuid);
        });
      ' "${database_name}"
  )"

  if [[ -z "${database_id}" ]]; then
    echo "Could not read the new database id. Run 'npx wrangler d1 list' and paste it into ${config}." >&2
    exit 70
  fi

  echo "Database id: ${database_id}"
  node -e '
    const { readFileSync, writeFileSync } = require("node:fs");
    const [file, placeholder, id] = process.argv.slice(1);
    writeFileSync(file, readFileSync(file, "utf8").replace(placeholder, id));
  ' "${config}" "${placeholder}" "${database_id}"
  echo "Wrote it into ${config} — commit that change."
fi

echo
echo "==> Applying the database schema"
$wrangler d1 migrations apply "${database_name}" --remote

echo
echo "==> Deploying the Worker"
$wrangler deploy

echo
echo "==> Deployed."
echo "Copy the workers.dev URL printed above, then point the site at it:"
echo "    npm run set-api-origin -- <that-url>"
