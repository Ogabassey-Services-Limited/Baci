#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  resolveCanonicalUrl,
  resolveLatestBlogPostUrl,
} from './measure-ogabassey-cwv-network-utils.mjs';
import {
  createDebugBearRunner,
  createPsiRunner,
} from './measure-ogabassey-cwv-runners.mjs';
import { printCwvSummaryTable } from './measure-ogabassey-cwv-summary-utils.mjs';
import {
  buildOgaBasseyCwvTargets,
  DEFAULT_OGABASSEY_CWV_TARGETS,
  filterOgaBasseyCwvTargets,
  loadEnvFile,
} from './measure-ogabassey-cwv-utils.mjs';

const repoRoot = fileURLToPath(new URL('../../../..', import.meta.url));
const appRoot = fileURLToPath(new URL('../..', import.meta.url));

await loadEnvFile(join(repoRoot, '.env.local'));
await loadEnvFile(join(appRoot, '.env.local'));
const auditId = new Date().toISOString().replace(/[:.]/g, '-');
const customOutputDir = process.env.OGABASSEY_AUDIT_OUTPUT_DIR || '';
const outputDir =
  customOutputDir ||
  join(repoRoot, 'output/audits', `ogabassey-cwv-${auditId}`);
const artifactFileName = (name) =>
  customOutputDir && name !== 'summary.json' ? `${auditId}-${name}` : name;
const psiApiKey =
  process.env.PAGESPEED_INSIGHTS_API_KEY || process.env.PSI_API_KEY || '';
const debugBearProjectId = process.env.DEBUGBEAR_PROJECT_ID?.trim() || '';
const debugBearProjectApiKey = process.env.DEBUGBEAR_API_KEY || '';
const debugBearAdminApiKey = process.env.DEBUGBEAR_ADMIN_API_KEY || '';
const debugBearApiKey = debugBearProjectId
  ? debugBearProjectApiKey || debugBearAdminApiKey
  : debugBearAdminApiKey || debugBearProjectApiKey;
const debugBearDevice = process.env.DEBUGBEAR_DEVICE || 'Mobile';
const debugBearRegion = process.env.DEBUGBEAR_REGION || 'us-east';
const debugBearMaxPollAttempts =
  Number(process.env.DEBUGBEAR_MAX_POLL_ATTEMPTS) || 90;
const debugBearPollIntervalMs =
  Number(process.env.DEBUGBEAR_POLL_INTERVAL_MS) || 5000;
const debugBearSetting = `${process.env.OGABASSEY_CWV_DEBUGBEAR ?? ''}`
  .trim()
  .toLowerCase();
const isDebugBearExplicitlyEnabled = ['1', 'true', 'yes', 'on'].includes(
  debugBearSetting
);
const isDebugBearDisabled = ['0', 'false', 'no', 'off'].includes(
  debugBearSetting
);
const shouldRunDebugBear = !isDebugBearDisabled && Boolean(debugBearApiKey);
const shouldRunPsi = process.env.OGABASSEY_CWV_PSI !== '0';
const shouldRunExternalProbes = shouldRunPsi || shouldRunDebugBear;
const targetLabelFilter = process.env.OGABASSEY_CWV_TARGET_LABELS || '';
const requestedTargetLabels = targetLabelFilter
  .split(',')
  .map((label) => label.trim().toLowerCase())
  .filter(Boolean);
const shouldIncludeLatestBlogPostTarget =
  requestedTargetLabels.length === 0 ||
  requestedTargetLabels.some((label) =>
    ['blog-post-latest', 'latest-blog-post'].includes(label)
  );
const strategies = (process.env.OGABASSEY_CWV_STRATEGIES || 'mobile,desktop')
  .split(',')
  .map((strategy) => strategy.trim())
  .filter(Boolean);
const runPsi = createPsiRunner({ apiKey: psiApiKey });
const debugBearRunner = createDebugBearRunner({
  adminApiKey: debugBearAdminApiKey,
  apiKey: debugBearApiKey,
  device: debugBearDevice,
  maxPollAttempts: debugBearMaxPollAttempts,
  pollIntervalMs: debugBearPollIntervalMs,
  projectId: debugBearProjectId,
  region: debugBearRegion,
});

await mkdir(outputDir, { recursive: true });
async function writeArtifact(name, payload) {
  await writeFile(
    join(outputDir, artifactFileName(name)),
    JSON.stringify(payload, null, 2)
  );
}
const skipLatestBlogPostTarget =
  process.env.OGABASSEY_CWV_SKIP_LATEST_BLOG_POST === '1';
const explicitBlogPostUrl = process.env.OGABASSEY_BLOG_POST_URL || '';
const shouldResolveLatestBlogPost =
  shouldRunExternalProbes &&
  shouldIncludeLatestBlogPostTarget &&
  !skipLatestBlogPostTarget &&
  !explicitBlogPostUrl;
const blogPostUrl = skipLatestBlogPostTarget
  ? null
  : explicitBlogPostUrl ||
    (shouldResolveLatestBlogPost
      ? await resolveLatestBlogPostUrl(
          process.env.OGABASSEY_BLOG_URL || 'https://ogabassey.com/blog'
        )
      : null);
const targetResolutionFailures =
  shouldResolveLatestBlogPost && !blogPostUrl
    ? [
        {
          label: 'blog-post-latest',
          message:
            'Could not resolve the latest blog post URL. Set OGABASSEY_BLOG_POST_URL or OGABASSEY_CWV_SKIP_LATEST_BLOG_POST=1.',
          source: 'target-resolution',
        },
      ]
    : [];
const requestedPdpUrl =
  process.env.OGABASSEY_PDP_LCP_URL ||
  process.env.OGABASSEY_PDP_URL ||
  DEFAULT_OGABASSEY_CWV_TARGETS.pdp;
const pdpUrl = shouldRunExternalProbes
  ? await resolveCanonicalUrl(requestedPdpUrl)
  : requestedPdpUrl;
const targets = filterOgaBasseyCwvTargets(
  buildOgaBasseyCwvTargets({
    blogPostUrl,
    blogUrl: process.env.OGABASSEY_BLOG_URL,
    homeUrl: process.env.OGABASSEY_HOME_URL,
    pdpUrl,
  }),
  targetLabelFilter
);

const summaries = [];
const failures = [
  ...targetResolutionFailures,
  ...(isDebugBearExplicitlyEnabled && !debugBearApiKey
    ? [
        {
          label: 'debugbear',
          message:
            'OGABASSEY_CWV_DEBUGBEAR explicitly enabled DebugBear, but DEBUGBEAR_API_KEY/DEBUGBEAR_ADMIN_API_KEY is not configured.',
          source: 'configuration',
        },
      ]
    : []),
  ...(shouldRunDebugBear && !debugBearProjectId && !debugBearAdminApiKey
    ? [
        {
          label: 'debugbear-projects',
          message:
            'DebugBear is enabled without DEBUGBEAR_PROJECT_ID, but DEBUGBEAR_ADMIN_API_KEY is not configured for project discovery.',
          source: 'configuration',
        },
      ]
    : []),
  ...(!shouldRunPsi && !shouldRunDebugBear
    ? [
        {
          label: 'measurement',
          message:
            'No CWV provider is scheduled. Enable PageSpeed Insights or configure DebugBear with an API key.',
          source: 'configuration',
        },
      ]
    : []),
  ...(targets.length === 0
    ? [
        {
          label: 'targets',
          message:
            'No CWV targets matched OGABASSEY_CWV_TARGET_LABELS. Use home, pdp-dell, blog-index, or blog-post-latest.',
          source: 'configuration',
        },
      ]
    : []),
];

function logProgress(message) {
  console.error(`[ogabassey-cwv] ${message}`);
}

if (shouldRunPsi) {
  for (const target of targets) {
    for (const strategy of strategies) {
      try {
        logProgress(`PSI ${strategy} ${target.label}`);
        const psi = await runPsi(target, strategy);
        const artifact = `${target.label}-${strategy}-psi.json`;
        await writeArtifact(artifact, psi.payload);
        summaries.push(psi.summary);
      } catch (error) {
        failures.push({
          label: target.label,
          message: error instanceof Error ? error.message : String(error),
          source: 'psi',
          strategy,
        });
      }
    }
  }
}

if (shouldRunDebugBear) {
  let projects = [];
  if (!debugBearProjectId) {
    try {
      logProgress('DebugBear projects');
      projects = await debugBearRunner.getProjects();
    } catch (error) {
      failures.push({
        label: 'projects',
        message: error instanceof Error ? error.message : String(error),
        source: 'debugbear',
      });
    }
  } else {
    logProgress(`DebugBear project ${debugBearProjectId}`);
  }

  if (!debugBearProjectId && projects.length === 0) {
    failures.push({
      label: 'projects',
      message:
        'DebugBear project discovery returned no projects. Set DEBUGBEAR_PROJECT_ID or use an admin key with project access.',
      source: 'debugbear',
    });
  }

  const debugBearTargets = debugBearProjectId || projects.length ? targets : [];
  for (const target of debugBearTargets) {
    try {
      logProgress(
        `DebugBear ${debugBearDevice}/${debugBearRegion} ${target.label}`
      );
      const debugBearResult = await debugBearRunner.run(target, projects);
      const artifact = `${target.label}-debugbear.json`;
      await writeArtifact(artifact, debugBearResult.payload);
      if (debugBearResult.failure) {
        failures.push({
          label: target.label,
          message: debugBearResult.failure,
          source: 'debugbear',
        });
      } else {
        summaries.push(debugBearResult.summary);
      }
    } catch (error) {
      failures.push({
        label: target.label,
        message: error instanceof Error ? error.message : String(error),
        source: 'debugbear',
      });
    }
  }
}

if (summaries.length === 0) {
  failures.push({
    label: 'measurement',
    message: 'No CWV measurement summaries were produced.',
    source: 'configuration',
  });
}

await writeArtifact('summary.json', {
  auditId,
  createdAt: new Date().toISOString(),
  failures,
  summaries,
  targets,
});

printCwvSummaryTable(summaries);
if (failures.length) {
  console.error('Failures:');
  console.error(JSON.stringify(failures, null, 2));
  process.exitCode = 1;
}
console.log(`Saved CWV audit artifacts to ${outputDir}`);
console.log(`Audit id: ${auditId}`);
