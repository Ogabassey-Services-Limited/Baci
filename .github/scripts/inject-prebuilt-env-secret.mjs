#!/usr/bin/env node
// Overwrite a single key in a Vercel-pulled dotenv file with a value taken from
// the process environment (supplied by a GitHub Actions secret).
//
// Why this exists: a *sensitive* (write-only) Vercel env var is returned EMPTY by
// `vercel pull` (it writes `KEY=""`). env.ts hard-requires QUIZ_RPC_SERVER_SECRET
// at build time once QUIZ_PHASE=production, so the local prebuilt `vercel build`
// in the deploy flow would fail its env validation on the empty value. Injecting
// the real value from a GitHub Actions secret keeps the Vercel var sensitive
// (never readable via the API/pull/dashboard) while making the prebuilt build
// self-sufficient. The injected key is server-only (env.ts throws if it is read
// on the client and it is not NEXT_PUBLIC_), so it is never bundled client-side.
//
// Usage: node inject-prebuilt-env-secret.mjs <KEY> <ENV_FILE>
// No-op (exit 0) when <KEY> is unset/empty in the environment, so deploys with no
// secret configured (e.g. quiz phase "1a") are unaffected.

import fs from 'node:fs';

const [key, file] = process.argv.slice(2);

if (!key || !file) {
  console.error('Usage: inject-prebuilt-env-secret.mjs <KEY> <ENV_FILE>');
  process.exit(2);
}

const value = process.env[key];

if (value === undefined || value === '') {
  console.log(`${key} not present in environment; leaving ${file} unchanged.`);
  process.exit(0);
}

// dotenv values are written as KEY="value". A double quote, backslash, or newline
// in the value would require escaping that the build-time parser may not honour
// identically, risking a corrupted secret in the build. Refuse instead.
if (/["\\\r\n]/.test(value)) {
  console.error(
    `${key} contains a double-quote, backslash, CR, or LF that cannot be safely ` +
      `written to ${file}. Use a value without those characters (hex/base64 is safe).`,
  );
  process.exit(1);
}

if (!fs.existsSync(file)) {
  console.error(
    `${file} does not exist; expected the "vercel pull" step to create it before injection.`,
  );
  process.exit(1);
}

const original = fs.readFileSync(file, 'utf8');
const kept = original.split('\n').filter((line) => !line.startsWith(`${key}=`));

// Drop trailing blank lines so repeated runs do not accumulate them, then write
// the key and exactly one trailing newline.
while (kept.length > 0 && kept[kept.length - 1] === '') kept.pop();
kept.push(`${key}="${value}"`);

fs.writeFileSync(file, `${kept.join('\n')}\n`);
console.log(`Injected ${key} into ${file} (value length ${value.length}).`);
