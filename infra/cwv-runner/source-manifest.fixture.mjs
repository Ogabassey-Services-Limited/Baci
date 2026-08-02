import { readdirSync } from 'node:fs';

// Test-only complete filesystem fixture; production proves the exact Git merge tree instead.
export const sourceArchiveFixturePaths = Object.freeze(
  readdirSync(new URL('.', import.meta.url), { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map(({ name }) => `infra/cwv-runner/${name}`)
    .sort((left, right) =>
      Buffer.compare(Buffer.from(left), Buffer.from(right))
    )
);
