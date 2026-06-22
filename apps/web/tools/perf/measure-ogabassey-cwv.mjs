#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getDebugBearQuickTestId,
  getDebugBearQuickTestPollPath,
} from './debugbear-quick-test-utils.mjs';
import {
  fetchJson,
  resolveCanonicalUrl,
  resolveLatestBlogPostUrl,
} from './measure-ogabassey-cwv-network-utils.mjs';
import {
  buildPsiUrl,
  getDebugBearFailureMessage,
  isDebugBearComplete,
  printCwvSummaryTable,
  summarizeDebugBearResult,
  summarizePsiResult,
} from './measure-ogabassey-cwv-summary-utils.mjs';
import {
  buildDebugBearHeaders,
  buildOgaBasseyCwvTargets,
  DEFAULT_OGABASSEY_CWV_TARGETS,
  findDebugBearProjectIdForUrl,
  loadEnvFile,
  normalizeDebugBearProjects,
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
  customOutputDir ? `${auditId}-${name}` : name;
const psiApiKey =
  process.env.PAGESPEED_INSIGHTS_API_KEY || process.env.PSI_API_KEY || '';
const debugBearProjectId = process.env.DEBUGBEAR_PROJECT_ID?.trim() || '';
const debugBearProjectApiKey = process.env.DEBUGBEAR_API_KEY || '';
const debugBearAdminApiKey = process.env.DEBUGBEAR_ADMIN_API_KEY || '';
const debugBearApiKey = debugBearProjectId
  ? debugBearProjectApiKey || debugBearAdminApiKey
  : debugBearAdminApiKey || debugBearProjectApiKey;
const debugBearDevice = process.env.DEBUGBEAR_DEVICE || 'Mobile';
const debugBearRegion = process.env.DEBUGBEAR_REGION || 'uk';
const debugBearMaxPollAttempts =
  Number(process.env.DEBUGBEAR_MAX_POLL_ATTEMPTS) || 90;
const debugBearPollIntervalMs =
  Number(process.env.DEBUGBEAR_POLL_INTERVAL_MS) || 5000;
const shouldRunDebugBear =
  process.env.OGABASSEY_CWV_DEBUGBEAR !== '0' && Boolean(debugBearApiKey);
const shouldRunPsi = process.env.OGABASSEY_CWV_PSI !== '0';
const shouldRunExternalProbes = shouldRunPsi || shouldRunDebugBear;
const strategies = (process.env.OGABASSEY_CWV_STRATEGIES || 'mobile,desktop')
  .split(',')
  .map((strategy) => strategy.trim())
  .filter(Boolean);
async function runPsi(target, strategy) {
  const url = buildPsiUrl({ apiKey: psiApiKey, strategy, url: target.url });
  const payload = await fetchJson(url);
  return {
    payload,
    summary: summarizePsiResult({
      label: target.label,
      payload,
      requestedUrl: target.url,
      strategy,
    }),
  };
}
function debugBear(path, init = {}, apiKey = debugBearApiKey) {
  return fetchJson(`https://www.debugbear.com/api/v1${path}`, {
    ...init,
    headers: {
      ...buildDebugBearHeaders(apiKey),
      ...(init.headers || {}),
    },
  });
}
async function getDebugBearProjects() {
  if (!debugBearAdminApiKey) {
    throw new Error(
      'Set DEBUGBEAR_ADMIN_API_KEY for project discovery or DEBUGBEAR_PROJECT_ID to skip discovery'
    );
  }
  const body = await debugBear('/projects', {}, debugBearAdminApiKey);
  return normalizeDebugBearProjects(body);
}
async function runDebugBear(target, projects) {
  const projectId =
    debugBearProjectId ||
    findDebugBearProjectIdForUrl(projects, target.url, {
      deviceName: debugBearDevice,
    });
  if (!projectId) {
    throw new Error(`No DebugBear project found for ${target.url}`);
  }
  const created = await debugBear(`/project/${projectId}/quickTests`, {
    body: JSON.stringify([
      { device: debugBearDevice, region: debugBearRegion, url: target.url },
    ]),
    method: 'POST',
  });

  const quickTestId = getDebugBearQuickTestId(created);
  if (!quickTestId) {
    throw new Error('DebugBear quick test response did not include an id');
  }

  const pollPath = getDebugBearQuickTestPollPath({
    body: created,
    projectId,
    quickTestId,
  });
  let result = created;
  for (let attempt = 0; attempt < debugBearMaxPollAttempts; attempt += 1) {
    result = await debugBear(pollPath);
    if (isDebugBearComplete(result)) break;
    await new Promise((resolve) =>
      setTimeout(resolve, debugBearPollIntervalMs)
    );
  }
  if (!isDebugBearComplete(result)) {
    throw new Error(
      `DebugBear poll timed out for ${target.label} after ${debugBearMaxPollAttempts} attempts`
    );
  }

  const failureMessage = getDebugBearFailureMessage(result);
  const payload = { created, result };
  if (failureMessage) {
    return {
      failure: failureMessage,
      payload,
    };
  }

  return {
    payload,
    summary: summarizeDebugBearResult({
      body: result,
      device: debugBearDevice,
      label: target.label,
      projectId,
      quickTestId,
      region: debugBearRegion,
      url: target.url,
    }),
  };
}

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
  shouldRunExternalProbes && !skipLatestBlogPostTarget && !explicitBlogPostUrl;
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
  process.env.OGABASSEY_PDP_URL || DEFAULT_OGABASSEY_CWV_TARGETS.pdp;
const pdpUrl = shouldRunExternalProbes
  ? await resolveCanonicalUrl(requestedPdpUrl)
  : requestedPdpUrl;
const targets = buildOgaBasseyCwvTargets({
  blogPostUrl,
  blogUrl: process.env.OGABASSEY_BLOG_URL,
  homeUrl: process.env.OGABASSEY_HOME_URL,
  pdpUrl,
});

const summaries = [];
const failures = [...targetResolutionFailures];

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
      projects = await getDebugBearProjects();
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
      const debugBearResult = await runDebugBear(target, projects);
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
