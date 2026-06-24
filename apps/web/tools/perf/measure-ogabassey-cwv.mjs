#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isFalseyEnvValue,
  isTruthyEnvValue,
  loadOgaBasseyCwvEnvFiles,
  normalizeEnvFlag,
} from './measure-ogabassey-cwv-env-utils.mjs';
import {
  resolveCanonicalUrlOrFailure,
  resolveLatestBlogPostUrl,
} from './measure-ogabassey-cwv-network-utils.mjs';
import {
  createDebugBearRunner,
  createPsiRunner,
} from './measure-ogabassey-cwv-runners.mjs';
import { printCwvSummaryTable } from './measure-ogabassey-cwv-summary-utils.mjs';
import {
  applyPdpCanonicalResolution,
  buildLegacyPdpLcpJson,
  buildOgaBasseyCwvConfigurationFailures,
  buildOgaBasseyCwvTargets,
  DEFAULT_OGABASSEY_CWV_TARGETS,
  filterOgaBasseyCwvTargets,
  logOgaBasseyCwvCompletion,
} from './measure-ogabassey-cwv-utils.mjs';

const repoRoot = fileURLToPath(new URL('../../../..', import.meta.url));
const appRoot = fileURLToPath(new URL('../..', import.meta.url));
export async function runOgaBasseyCwv() {
  await loadOgaBasseyCwvEnvFiles({ appRoot, repoRoot });
  const auditId = new Date().toISOString().replace(/[:.]/g, '-');
  const useDebugBearRawDir = isTruthyEnvValue(
    process.env.OGABASSEY_CWV_USE_DEBUGBEAR_RAW_DIR
  );
  const customOutputDir =
    process.env.OGABASSEY_AUDIT_OUTPUT_DIR?.trim() ||
    (useDebugBearRawDir ? process.env.DEBUGBEAR_RAW_DIR?.trim() : '') ||
    process.env.OGABASSEY_CWV_DEFAULT_OUTPUT_DIR?.trim() ||
    '';
  const outputDir =
    customOutputDir ||
    join(repoRoot, 'output/audits', `ogabassey-cwv-${auditId}`);
  const artifactFileName = (name) =>
    customOutputDir && name !== 'summary.json' ? `${auditId}-${name}` : name;
  const psiApiKey =
    process.env.PAGESPEED_INSIGHTS_API_KEY || process.env.PSI_API_KEY || '';
  const debugBearProjectId = process.env.DEBUGBEAR_PROJECT_ID?.trim() || '';
  const debugBearProjectApiKey = process.env.DEBUGBEAR_API_KEY?.trim() || '';
  const debugBearAdminApiKey =
    process.env.DEBUGBEAR_ADMIN_API_KEY?.trim() || '';
  const debugBearSetting = normalizeEnvFlag(
    process.env.OGABASSEY_CWV_DEBUGBEAR
  );
  const isDebugBearExplicitlyEnabled = isTruthyEnvValue(debugBearSetting);
  const isDebugBearDisabled = isFalseyEnvValue(debugBearSetting);
  const debugBearDiscoveryApiKey =
    debugBearAdminApiKey ||
    (!debugBearProjectId && isDebugBearExplicitlyEnabled
      ? debugBearProjectApiKey
      : '');
  const debugBearApiKey = debugBearProjectId
    ? debugBearProjectApiKey || debugBearAdminApiKey
    : debugBearDiscoveryApiKey;
  const debugBearDeviceOverride = process.env.DEBUGBEAR_DEVICE?.trim() || '';
  const debugBearDevice = debugBearDeviceOverride || 'Mobile';
  const debugBearRequiresConfiguredDeviceUserAgent = !isFalseyEnvValue(
    process.env.OGABASSEY_CWV_REQUIRE_DEBUGBEAR_DEVICE_UA
  );
  const hasConfiguredDebugBearDeviceUserAgent = Boolean(
    debugBearDeviceOverride
  );
  const debugBearRegion = process.env.DEBUGBEAR_REGION || 'us-east';
  const debugBearMaxPollAttempts =
    Number(process.env.DEBUGBEAR_MAX_POLL_ATTEMPTS) || 90;
  const debugBearPollIntervalMs =
    Number(process.env.DEBUGBEAR_POLL_INTERVAL_MS) || 5000;
  const hasDiscoverableDebugBearProject = Boolean(
    debugBearProjectId || debugBearDiscoveryApiKey
  );
  const shouldAttemptDebugBear =
    isDebugBearExplicitlyEnabled ||
    Boolean(debugBearProjectId || debugBearAdminApiKey);
  const canRunDebugBearWithStableUserAgent =
    !debugBearRequiresConfiguredDeviceUserAgent ||
    hasConfiguredDebugBearDeviceUserAgent;
  const shouldRunDebugBear =
    !isDebugBearDisabled &&
    shouldAttemptDebugBear &&
    Boolean(debugBearApiKey) &&
    hasDiscoverableDebugBearProject &&
    canRunDebugBearWithStableUserAgent;
  const shouldRunPsi = !isFalseyEnvValue(process.env.OGABASSEY_CWV_PSI);
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
    adminApiKey: debugBearDiscoveryApiKey,
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
  const skipLatestBlogPostTarget = isTruthyEnvValue(
    process.env.OGABASSEY_CWV_SKIP_LATEST_BLOG_POST
  );
  const explicitBlogPostUrl = process.env.OGABASSEY_BLOG_POST_URL?.trim() || '';
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
            process.env.OGABASSEY_BLOG_URL?.trim() ||
              DEFAULT_OGABASSEY_CWV_TARGETS.blog
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
  const shouldUsePdpLcpUrl = isTruthyEnvValue(
    process.env.OGABASSEY_CWV_USE_PDP_LCP_URL
  );
  const requestedPdpUrl =
    (shouldUsePdpLcpUrl ? process.env.OGABASSEY_PDP_LCP_URL?.trim() : '') ||
    process.env.OGABASSEY_PDP_URL?.trim() ||
    DEFAULT_OGABASSEY_CWV_TARGETS.pdp;
  const shouldResolvePdpCanonical = !isFalseyEnvValue(
    process.env.OGABASSEY_CWV_RESOLVE_PDP_CANONICAL
  );
  let targets = filterOgaBasseyCwvTargets(
    buildOgaBasseyCwvTargets({
      blogPostUrl,
      blogUrl: process.env.OGABASSEY_BLOG_URL,
      homeUrl: process.env.OGABASSEY_HOME_URL,
      pdpUrl: requestedPdpUrl,
    }),
    targetLabelFilter
  );
  const pdpTarget = targets.find((target) => target.label === 'pdp-dell');
  if (pdpTarget && shouldRunExternalProbes && shouldResolvePdpCanonical) {
    const pdpResolution = await resolveCanonicalUrlOrFailure(requestedPdpUrl, {
      label: pdpTarget.label,
    });
    targets = applyPdpCanonicalResolution({
      pdpResolution,
      pdpTarget,
      targetResolutionFailures,
      targets,
    });
  }
  const summaries = [];
  const failures = buildOgaBasseyCwvConfigurationFailures({
    debugBearApiKey,
    debugBearRequiresConfiguredDeviceUserAgent,
    hasConfiguredDebugBearDeviceUserAgent,
    hasDiscoverableDebugBearProject,
    isDebugBearDisabled,
    isDebugBearExplicitlyEnabled,
    shouldAttemptDebugBear,
    shouldRunDebugBear,
    shouldRunPsi,
    targetResolutionFailures,
    targets,
  });
  const logProgress = (message) => console.error(`[ogabassey-cwv] ${message}`);
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
    const debugBearTargets =
      debugBearProjectId || projects.length ? targets : [];
    for (const target of debugBearTargets) {
      try {
        logProgress(
          `DebugBear ${debugBearDevice}/${debugBearRegion} ${target.label}`
        );
        const debugBearResult = await debugBearRunner.run(target, projects);
        const artifact = `${target.label}-debugbear.json`;
        await writeArtifact(artifact, debugBearResult.payload);
        if (debugBearResult.summary) {
          summaries.push(debugBearResult.summary);
        }
        if (debugBearResult.failure) {
          failures.push({
            label: target.label,
            message: debugBearResult.failure,
            source: 'debugbear',
          });
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
  const shouldPrintLegacyPdpJson = isTruthyEnvValue(
    process.env.OGABASSEY_CWV_LEGACY_PDP_LCP_JSON
  );
  const shouldPrintSummaryTable =
    !shouldPrintLegacyPdpJson &&
    !isFalseyEnvValue(process.env.OGABASSEY_CWV_SUMMARY_TABLE);

  if (shouldPrintSummaryTable) {
    printCwvSummaryTable(summaries);
  }
  if (failures.length) {
    console.error('Failures:');
    console.error(JSON.stringify(failures, null, 2));
    process.exitCode = 1;
  }

  if (shouldPrintLegacyPdpJson) {
    const summary =
      summaries.find((row) => row.label === 'pdp-dell') ?? summaries[0];
    if (summary) {
      console.log(JSON.stringify(buildLegacyPdpLcpJson(summary)));
    }
  }
  logOgaBasseyCwvCompletion(auditId, outputDir, shouldPrintLegacyPdpJson);
}
if (import.meta.main) await runOgaBasseyCwv();
