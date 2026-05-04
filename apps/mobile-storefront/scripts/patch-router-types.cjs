#!/usr/bin/env node
/**
 * Patch the auto-generated `.expo/types/router.d.ts` to include the (tabs)/
 * group routes that Expo Router's typegen omits for this drawer+tabs setup.
 *
 * Background: tab routes (`/`, `/cart`, `/account`) live under app/(tabs)/ and
 * are reached as bare paths at runtime, but Expo's type generator drops them
 * from the `Href` union, causing `router.push('/')` etc. to fail typecheck.
 *
 * Idempotent — safe to run repeatedly. No-op when the file already includes
 * the patch marker or doesn't exist. The patch is appended just before the
 * trailing `;` of each route-field line.
 */
const fs = require('node:fs');
const path = require('node:path');

const FILE = path.resolve(__dirname, '..', '.expo', 'types', 'router.d.ts');

if (!fs.existsSync(FILE)) {
  process.exit(0);
}

let original;
try {
  original = fs.readFileSync(FILE, 'utf8');
} catch (err) {
  console.error(`patch-router-types: failed to read ${FILE}:`, err);
  process.exit(1);
}

if (original.includes('TAB_ROUTES_PATCH')) {
  process.exit(0);
}

const TAB_ROUTES = ['/', '/cart', '/account'];

const inputAddition = TAB_ROUTES.map(
  (r) => `{ pathname: \`${r}\`; params?: Router.UnknownInputParams; }`
).join(' | ');

const outputAddition = TAB_ROUTES.map(
  (r) => `{ pathname: \`${r}\`; params?: Router.UnknownOutputParams; }`
).join(' | ');

// Produces a TypeScript template-literal union per route, e.g. for `/cart`:
//   `/cart${`?${string}` | `#${string}` | ''}`
// — i.e. the route followed by an optional query string, hash fragment, or
// nothing at all. Mirrors the shape Expo Router emits for non-tab routes.
const HREF_TEMPLATE_SUFFIX = '${`?${string}` | `#${string}` | \'\'}';
const hrefAddition = TAB_ROUTES.map(
  (r) => `\`${r}${HREF_TEMPLATE_SUFFIX}\``
).join(' | ');

// Each field (hrefInputParams / hrefOutputParams / href) is rendered on a
// single line that terminates with `;\n`. Append the tab-route extensions
// just before the closing `;` of that line — picking up the trailing-`;`
// nearest the newline (greedy match on non-newline chars).
//
// Track per-field hit counts so partial successes (e.g. one field renamed
// upstream while the other two still match) fail loudly instead of writing
// a half-patched output.
const replacementHits = { hrefInputParams: 0, hrefOutputParams: 0, href: 0 };
const patched = original
  .replace(/(\n\s+hrefInputParams:[^\n]+);(\n)/, (_m, head, nl) => {
    replacementHits.hrefInputParams += 1;
    return `${head} | ${inputAddition} /* TAB_ROUTES_PATCH */;${nl}`;
  })
  .replace(/(\n\s+hrefOutputParams:[^\n]+);(\n)/, (_m, head, nl) => {
    replacementHits.hrefOutputParams += 1;
    return `${head} | ${outputAddition} /* TAB_ROUTES_PATCH */;${nl}`;
  })
  .replace(/(\n\s+href:[^\n]+);(\n)/, (_m, head, nl) => {
    replacementHits.href += 1;
    return `${head} | ${hrefAddition} /* TAB_ROUTES_PATCH */;${nl}`;
  });

const missingFields = Object.entries(replacementHits)
  .filter(([, count]) => count === 0)
  .map(([field]) => field);

if (missingFields.length > 0) {
  console.error(
    `patch-router-types: no insertion points matched for ${missingFields.join(', ')}; file format may have changed`
  );
  process.exit(1);
}

const relPath = path.relative(process.cwd(), FILE);
try {
  fs.writeFileSync(FILE, patched, 'utf8');
} catch (err) {
  console.error(`patch-router-types: failed to write ${relPath}:`, err);
  process.exit(1);
}
console.log('patch-router-types: tab routes injected into', relPath);
