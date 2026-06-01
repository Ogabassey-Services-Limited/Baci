import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const workflowPath = resolve(
  currentDirectory,
  '../../../../.github/workflows/ci.yml'
);
const deployWorkflowPath = resolve(
  currentDirectory,
  '../../../../.github/workflows/deploy.yml'
);
const securityWorkflowPath = resolve(
  currentDirectory,
  '../../../../.github/workflows/security.yml'
);
const bundleAnalysisWorkflowPath = resolve(
  currentDirectory,
  '../../../../.github/workflows/bundle-analysis.yml'
);
const workflow = readFileSync(workflowPath, 'utf8');
const deployWorkflow = readFileSync(deployWorkflowPath, 'utf8');
const securityWorkflow = readFileSync(securityWorkflowPath, 'utf8');
const bundleAnalysisWorkflow = readFileSync(bundleAnalysisWorkflowPath, 'utf8');
const WEB_FILTER_REGEX = /^\s{12}web:\n(?<body>(?:\s{14}- .+\n)+)/m;

function getWebFilter(workflowContent = workflow) {
  return workflowContent.match(WEB_FILTER_REGEX)?.groups?.body;
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

  it('runs web quality and deploy workflows when root Next config changes', () => {
    const ciWebFilter = getWebFilter();
    const deployWebFilter = getWebFilter(deployWorkflow);

    expect(ciWebFilter).toContain("- 'next.config.ts'");
    expect(ciWebFilter).toContain("- 'next.config.test.ts'");
    expect(deployWebFilter).toContain("- 'next.config.ts'");
    expect(deployWebFilter).toContain("- 'next.config.test.ts'");
  });

  it('keeps root Next config in targeted security scans', () => {
    expect(securityWorkflow).toContain("- 'next.config.ts'");
    expect(securityWorkflow).toContain('next\\.config\\.ts$');
    expect(securityWorkflow).toMatch(/\snext\.config\.ts\s+\\/);
  });

  it('runs bundle analysis when root Next config changes', () => {
    expect(bundleAnalysisWorkflow).toContain('- "next.config.ts"');
  });
});
