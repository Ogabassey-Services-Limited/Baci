#!/usr/bin/env node
// Ensure a single key is present in a Vercel-pulled dotenv file so the local
// prebuilt `vercel build` passes env.ts's build-time presence validation for a
// *sensitive* (write-only) Vercel env var — which `vercel pull` returns EMPTY
// (`KEY=""`). The value is consumed only at RUNTIME (e.g. quiz-proof HMAC
// signing), where Vercel injects the real sensitive value and env.ts re-validates
// against it (getRuntimeEnvValue prefers live process.env). The injected key is
// server-only (env.ts throws if read on the client, not NEXT_PUBLIC_), so it is
// never bundled client-side.
//
// Usage: node inject-prebuilt-env-secret.mjs <KEY> <ENV_FILE>
// Env:
//   <KEY>                 real value (e.g. a GitHub Actions secret). If non-empty,
//                         it is injected unconditionally.
//   <KEY>__BUILD_STANDIN  optional non-secret build-time stand-in. Used only when
//                         <KEY> is empty AND the pulled file already contains a
//                         `<KEY>=` entry — i.e. the sensitive var EXISTS in Vercel
//                         (pulled empty) and will be injected at runtime. If the
//                         key is absent, the var is genuinely missing from Vercel,
//                         so a stand-in would let the build pass while runtime has
//                         no secret matching the database; the script fails loudly
//                         instead of masking that.
// No-op (exit 0) when neither is set, so deploys with nothing configured (e.g.
// quiz phase "1a") are unaffected.

import fs from 'node:fs';

const [key, file] = process.argv.slice(2);

if (!key || !file) {
  console.error('Usage: inject-prebuilt-env-secret.mjs <KEY> <ENV_FILE>');
  process.exit(2);
}

const realValue = process.env[key];
const standinValue = process.env[`${key}__BUILD_STANDIN`];

let value;
let usingStandin = false;
if (realValue !== undefined && realValue !== '') {
  value = realValue;
} else if (standinValue !== undefined && standinValue !== '') {
  value = standinValue;
  usingStandin = true;
} else {
  console.log(`${key} not present in environment; leaving ${file} unchanged.`);
  process.exit(0);
}

// dotenv values are written as KEY="value". A double quote, backslash, or newline
// would require escaping the build-time parser may not honour identically, risking
// a corrupted secret in the build. Refuse instead.
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

const lines = fs.readFileSync(file, 'utf8').split('\n');
const hasKey = lines.some((line) => line.startsWith(`${key}=`));

// A stand-in may only substitute for a sensitive var that already EXISTS in
// Vercel — evidenced by `vercel pull` writing an (empty) `KEY=` entry. If the key
// is absent, the sensitive var is genuinely missing (not merely write-only), and a
// stand-in would let the build pass while the runtime has no secret matching the
// database. Fail loudly rather than mask a missing runtime secret.
if (usingStandin && !hasKey) {
  console.error(
    `${key} is absent from ${file}: the sensitive Vercel variable appears to be ` +
      `missing, not just write-only. Refusing to inject a build-time stand-in, which ` +
      `would mask a missing runtime secret. Configure ${key} in Vercel, or set the ` +
      `${key} GitHub Actions secret.`,
  );
  process.exit(1);
}

const kept = lines.filter((line) => !line.startsWith(`${key}=`));
// Drop trailing blank lines so repeated runs do not accumulate them.
while (kept.length > 0 && kept[kept.length - 1] === '') kept.pop();
kept.push(`${key}="${value}"`);

fs.writeFileSync(file, `${kept.join('\n')}\n`);
console.log(
  `Injected ${key} into ${file} (${usingStandin ? 'build-time stand-in' : 'configured value'}, length ${value.length}).`,
);
