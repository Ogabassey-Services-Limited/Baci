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
const WEB_FILTER_REGEX = /^\s{12}web:\n(?<body>(?:\s{14}- .+\n)+)/m;

function getWebFilter() {
  return workflow.match(WEB_FILTER_REGEX)?.groups?.body;
}

describe('CI workflow quiz asset coverage', () => {
  it('runs quiz asset verification when mobile quiz assets change', () => {
    const webFilter = getWebFilter();

    expect(webFilter).toContain(
      "- 'apps/mobile-storefront/assets/quiz/**'"
    );
    expect(workflow).toMatch(
      /if: needs\.changes\.outputs\.web == 'true'\n\s+run: pnpm --filter @baci\/web verify:quiz-assets/
    );
  });

  it('runs quiz asset verification when scanned mobile quiz source roots change', () => {
    const webFilter = getWebFilter();

    expect(webFilter).toContain("- 'apps/mobile-storefront/app/**'");
    expect(webFilter).toContain("- 'apps/mobile-storefront/components/**'");
    expect(webFilter).toContain("- 'apps/mobile-storefront/constants/**'");
    expect(webFilter).toContain("- 'apps/mobile-storefront/hooks/**'");
    expect(webFilter).toContain("- 'apps/mobile-storefront/lib/**'");
    expect(webFilter).toContain("- 'apps/mobile-storefront/schemas/**'");
    expect(webFilter).toContain("- 'apps/mobile-storefront/services/**'");
    expect(webFilter).toContain("- 'apps/mobile-storefront/stores/**'");
  });
});
