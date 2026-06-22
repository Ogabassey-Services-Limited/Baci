#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getDebugBearQuickTestId,
  getDebugBearQuickTestPollPath,
} from './debugbear-quick-test-utils.mjs';
import {
  fetchJson,
  resolveLatestBlogPostUrl,
} from './measure-ogabassey-cwv-network-utils.mjs';
import {
  buildPsiUrl,
  formatMetricMs,
  isDebugBearComplete,
  summarizeDebugBearResult,
  summarizePsiResult,
} from './measure-ogabassey-cwv-summary-utils.mjs';
import {
  buildDebugBearHeaders,
  buildOgaBasseyCwvTargets,
  findDebugBearProjectIdForUrl,
  normalizeDebugBearProjects,
} from './measure-ogabassey-cwv-utils.mjs';

const repoRoot = fileURLToPath(new URL('../../../..', import.meta.url));
const appRoot = fileURLToPath(new URL('../..', import.meta.url));

await loadEnvFile(join(repoRoot, '.env.local'));
await loadEnvFile(join(appRoot, '.env.local'));

const auditId = new Date().toISOString().replace(/[:.]/g, '-');
const outputDir =
  process.env.OGABASSEY_AUDIT_OUTPUT_DIR ||
  join(repoRoot, 'output/audits', `ogabassey-cwv-${auditId}`);
const psiApiKey =
  process.env.PAGESPEED_INSIGHTS_API_KEY || process.env.PSI_API_KEY || '';
const debugBearApiKey =
  process.env.DEBUGBEAR_API_KEY || process.env.DEBUGBEAR_ADMIN_API_KEY || '';
const debugBearDevice = process.env.DEBUGBEAR_DEVICE || 'Mobile';
const debugBearRegion = process.env.DEBUGBEAR_REGION || 'uk';
const debugBearMaxPollAttempts =
  Number(process.env.DEBUGBEAR_MAX_POLL_ATTEMPTS) || 90;
const debugBearPollIntervalMs =
  Number(process.env.DEBUGBEAR_POLL_INTERVAL_MS) || 5000;
const shouldRunDebugBear =
  process.env.OGABASSEY_CWV_DEBUGBEAR !== '0' && Boolean(debugBearApiKey);
const shouldRunPsi = process.env.OGABASSEY_CWV_PSI !== '0';
const strategies = (process.env.OGABASSEY_CWV_STRATEGIES || 'mobile,desktop')
  .split(',')
  .map((strategy) => strategy.trim())
  .filter(Boolean);

async function loadEnvFile(path) {
  if (!existsSync(path)) return;
  const text = await readFile(path, 'utf8');
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const index = trimmed.indexOf('=');
    const key = trimmed.slice(0, index).trim();
    const raw = trimmed.slice(index + 1).trim();
    if (!key || process.env[key] !== undefined) continue;
    process.env[key] = raw.replace(/^['"]|['"]$/g, '');
  }
}

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

function debugBear(path, init = {}) {
  return fetchJson(`https://www.debugbear.com/api/v1${path}`, {
    ...init,
    headers: {
      ...buildDebugBearHeaders(debugBearApiKey),
      ...(init.headers || {}),
    },
  });
}

async function getDebugBearProjects() {
  const body = await debugBear('/projects');
  return normalizeDebugBearProjects(body);
}

async function runDebugBear(target, projects) {
  const projectId = findDebugBearProjectIdForUrl(projects, target.url);
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
    logProgress(`DebugBear poll timed out for ${target.label}`);
  }

  return {
    payload: { created, result },
    summary: summarizeDebugBearResult({
      body: result,
      label: target.label,
      projectId,
      quickTestId,
      url: target.url,
    }),
  };
}

function printTable(rows) {
  console.table(
    rows.map((row) => ({
      route: row.label,
      source: row.source,
      strategy: row.strategy ?? '-',
      perf: row.performance ?? '-',
      seo: row.seo ?? '-',
      lcp: formatMetricMs(row.lcpMs) ?? '-',
      fcp: formatMetricMs(row.fcpMs) ?? '-',
      tbt: formatMetricMs(row.tbtMs) ?? '-',
      cls: row.cls ?? '-',
      fieldLcp: row.fieldLcp?.p75 ?? '-',
      fieldScope: row.fieldLcp?.scope ?? '-',
      result: row.resultUrl ?? '-',
    }))
  );
}

await mkdir(outputDir, { recursive: true });

const blogPostUrl = await resolveLatestBlogPostUrl(
  process.env.OGABASSEY_BLOG_URL || 'https://ogabassey.com/blog'
);
const targets = buildOgaBasseyCwvTargets({
  blogPostUrl,
  blogUrl: process.env.OGABASSEY_BLOG_URL,
  homeUrl: process.env.OGABASSEY_HOME_URL,
  pdpUrl: process.env.OGABASSEY_PDP_URL,
});

const summaries = [];
const failures = [];

function logProgress(message) {
  console.error(`[ogabassey-cwv] ${message}`);
}

if (shouldRunPsi) {
  for (const target of targets) {
    for (const strategy of strategies) {
      try {
        logProgress(`PSI ${strategy} ${target.label}`);
        const psi = await runPsi(target, strategy);
        await writeFile(
          join(outputDir, `${target.label}-${strategy}-psi.json`),
          JSON.stringify(psi.payload, null, 2)
        );
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
  try {
    logProgress('DebugBear projects');
    projects = await getDebugBearProjects();
    await writeFile(
      join(outputDir, 'debugbear-projects.json'),
      JSON.stringify(projects, null, 2)
    );
  } catch (error) {
    failures.push({
      label: 'projects',
      message: error instanceof Error ? error.message : String(error),
      source: 'debugbear',
    });
  }

  for (const target of projects.length ? targets : []) {
    try {
      logProgress(
        `DebugBear ${debugBearDevice}/${debugBearRegion} ${target.label}`
      );
      const debugBearResult = await runDebugBear(target, projects);
      await writeFile(
        join(outputDir, `${target.label}-debugbear.json`),
        JSON.stringify(debugBearResult.payload, null, 2)
      );
      summaries.push(debugBearResult.summary);
    } catch (error) {
      failures.push({
        label: target.label,
        message: error instanceof Error ? error.message : String(error),
        source: 'debugbear',
      });
    }
  }
}

await writeFile(
  join(outputDir, 'summary.json'),
  JSON.stringify(
    {
      auditId,
      createdAt: new Date().toISOString(),
      failures,
      summaries,
      targets,
    },
    null,
    2
  )
);

printTable(summaries);
if (failures.length) {
  console.error('Failures:');
  console.error(JSON.stringify(failures, null, 2));
}
console.log(`Saved CWV audit artifacts to ${outputDir}`);
console.log(`Audit id: ${auditId}`);
