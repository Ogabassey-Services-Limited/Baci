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
const deployFilterPath = resolve(
  currentDirectory,
  '../../../../.github/filters/deploy.yml'
);
const securityWorkflowPath = resolve(
  currentDirectory,
  '../../../../.github/workflows/security.yml'
);
const bundleAnalysisWorkflowPath = resolve(
  currentDirectory,
  '../../../../.github/workflows/bundle-analysis.yml'
);
const androidReleaseWorkflowPath = resolve(
  currentDirectory,
  '../../../../.github/workflows/android-release.yml'
);
const webPackageJsonPath = resolve(currentDirectory, '../../package.json');
const workflow = readFileSync(workflowPath, 'utf8');
const deployWorkflow = readFileSync(deployWorkflowPath, 'utf8');
const deployFilters = readFileSync(deployFilterPath, 'utf8');
const securityWorkflow = readFileSync(securityWorkflowPath, 'utf8');
const bundleAnalysisWorkflow = readFileSync(bundleAnalysisWorkflowPath, 'utf8');
const androidReleaseWorkflow = readFileSync(androidReleaseWorkflowPath, 'utf8');
const webPackageJson = JSON.parse(readFileSync(webPackageJsonPath, 'utf8')) as {
  scripts?: Record<string, string>;
};
const WEB_FILTER_REGEX = /^\s{12}web:\n(?<body>(?:\s{14}- .+\n)+)/m;
const DEPLOY_WEB_FILTER_REGEX = /^web:\n(?<body>(?:\s{2}- .+\n)+)/m;

function getWebFilter(workflowContent = workflow) {
  return workflowContent.match(WEB_FILTER_REGEX)?.groups?.body;
}

function getDeployWebFilter() {
  return deployFilters.match(DEPLOY_WEB_FILTER_REGEX)?.groups?.body;
}

describe('CI workflow quiz asset coverage', () => {
  it('runs quiz asset verification when mobile quiz assets change', () => {
    const webFilter = getWebFilter();

    expect(webFilter).toContain(
      "- 'apps/mobile-storefront/assets/quiz/**'"
    );
    expect(workflow).toMatch(
      /if: needs\.changes\.outputs\.web == 'true' \|\| needs\.changes\.outputs\.quiz_db == 'true'\n\s+run: pnpm --filter @baci\/web verify:quiz-assets/
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
    const deployWebFilter = getDeployWebFilter();

    expect(ciWebFilter).toContain("- 'next.config.ts'");
    expect(ciWebFilter).toContain("- 'next.config.test.ts'");
    expect(deployWorkflow).toContain('filters: .github/filters/deploy.yml');
    expect(deployWebFilter).toContain("- 'next.config.ts'");
    expect(deployWebFilter).toContain("- 'next.config.test.ts'");
  });

  it('deploys executable storefront release-coherence dependencies', () => {
    const deployWebFilter = getDeployWebFilter();

    expect(deployWebFilter).toContain(
      "- '.github/scripts/storefront-release-coherence.mjs'"
    );
    expect(deployWebFilter).toContain(
      "- '.github/scripts/storefront-release-config.mjs'"
    );
    expect(deployWebFilter).toContain(
      "- '.github/scripts/storefront-release-marker.mjs'"
    );
  });

  it('keeps root Next config in targeted security scans', () => {
    expect(securityWorkflow).toContain("- 'next.config.ts'");
    expect(securityWorkflow).toContain('next\\.config\\.ts$');
    expect(securityWorkflow).toMatch(/\snext\.config\.ts\s+\\/);
  });

  it('runs bundle analysis when root Next config changes', () => {
    expect(bundleAnalysisWorkflow).toContain('- "next.config.ts"');
  });

  it('uses the Turbopack-compatible Next bundle analyzer script', () => {
    expect(webPackageJson.scripts?.analyze).toBe(
      'next experimental-analyze --output'
    );
  });

  it('keeps enough memory available for bundle analysis in CI', () => {
    expect(bundleAnalysisWorkflow).toContain(
      'NODE_OPTIONS: "--max_old_space_size=8192"'
    );
  });

  it('uploads the Next Turbopack analyzer output directory when present', () => {
    expect(bundleAnalysisWorkflow).toContain(
      'path: apps/web/.next/diagnostics/analyze/'
    );
    expect(bundleAnalysisWorkflow).toContain('if-no-files-found: warn');
  });

  it('keeps Android Play rejected-change recovery explicit', () => {
    expect(androidReleaseWorkflow).toContain(
      'ANDROID_ADMIN_CHANGES_NOT_SENT_FOR_REVIEW'
    );
    expect(androidReleaseWorkflow).toContain(
      "github.event_name == 'workflow_dispatch' && inputs.changes_not_sent_for_review"
    );
    expect(androidReleaseWorkflow).toContain(
      "env.ANDROID_ADMIN_CHANGES_NOT_SENT_FOR_REVIEW == 'true'"
    );
  });
});
