import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const workflowPath = resolve(
  currentDirectory,
  '../../../../.github/workflows/ci.yml'
);
const workflow = readFileSync(workflowPath, 'utf8');

describe('CI workflow quiz asset coverage', () => {
  it('runs quiz asset verification when mobile quiz assets change', () => {
    const webFilter = workflow.match(
      /^\s{12}web:\n(?<body>(?:\s{14}- .+\n)+)/m
    )?.groups?.body;

    expect(webFilter).toContain(
      "- 'apps/mobile-storefront/assets/quiz/**'"
    );
    expect(workflow).toMatch(
      /if: needs\.changes\.outputs\.web == 'true'\n\s+run: pnpm --filter @baci\/web verify:quiz-assets/
    );
  });
});
