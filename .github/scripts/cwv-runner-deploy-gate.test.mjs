import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const root = new URL('../..', import.meta.url);

async function workflow(path) {
  return YAML.parse(await readFile(new URL(path, root), 'utf8'));
}

function filterPaths(job, name) {
  const filter = job.steps.find((step) => step.id === 'filter');
  const source = filter.with.filters;
  const match = source.match(new RegExp(`^${name}:\\n(?<paths>(?:  - .+\\n?)+)`, 'm'));

  return match?.groups?.paths ?? '';
}

function step(job, name) {
  return job.steps.find((candidate) => candidate.name === name);
}

test('runs CWV contracts and production deployment for runner-only main changes', async () => {
  const [ci, deploy] = await Promise.all([
    workflow('.github/workflows/ci.yml'),
    workflow('.github/workflows/deploy.yml'),
  ]);

  const ciChanges = ci.jobs.changes;
  const ciGate = ci.jobs['cwv-runner-contracts'];
  const deployChanges = deploy.jobs.changes;
  const deployGate = deploy.jobs['cwv-runner-contracts'];
  const deployProduction = deploy.jobs['deploy-production'];

  assert.equal(
    ciChanges.outputs.cwv_runner,
    '${{ steps.gate.outputs.cwv_runner }}',
  );
  assert.match(filterPaths(ciChanges, 'cwv_runner'), /'infra\/cwv-runner\/\*\*'/);
  assert.match(filterPaths(ciChanges, 'cwv_runner'), /'package\.json'/);
  assert.match(filterPaths(ciChanges, 'cwv_runner'), /'pnpm-lock\.yaml'/);
  assert.doesNotMatch(filterPaths(ciChanges, 'web'), /'infra\/cwv-runner\/\*\*'/);
  assert.equal(ciGate.if, "needs.changes.outputs.cwv_runner == 'true'");

  assert.equal(
    deployChanges.outputs.cwv_runner,
    '${{ steps.filter.outputs.cwv_runner }}',
  );
  assert.match(filterPaths(deployChanges, 'cwv_runner'), /'infra\/cwv-runner\/\*\*'/);
  assert.match(filterPaths(deployChanges, 'cwv_runner'), /'package\.json'/);
  assert.match(filterPaths(deployChanges, 'cwv_runner'), /'pnpm-lock\.yaml'/);
  assert.match(filterPaths(deployChanges, 'web'), /'infra\/cwv-runner\/\*\*'/);
  assert.equal(deployGate.if, "needs.changes.outputs.cwv_runner == 'true'");

  for (const gate of [ciGate, deployGate]) {
    assert.deepEqual(gate.needs, ['changes']);
    assert.match(
      step(gate, 'Run CWV runner contract tests').run,
      /^node --test --test-concurrency=1 infra\/cwv-runner\/\*\.test\.mjs \.github\/scripts\/cwv-runner-\*\.test\.mjs \.github\/scripts\/actionlint-runner-label-contract\.test\.mjs$/,
    );
    assert.equal(
      step(gate, 'Check CWV runner formatting').run,
      'pnpm exec biome check infra/cwv-runner .github/scripts/cwv-runner-*.mjs',
    );
    assert.equal(step(gate, 'Run CWV workflow actionlint').uses, 'rhysd/actionlint@914e7df21a07ef503a81201c76d2b11c789d3fca');
  }

  assert.ok(deployProduction.needs.includes('cwv-runner-contracts'));
  assert.match(
    deployProduction.if,
    /needs\.cwv-runner-contracts\.result == 'success' \|\| needs\.cwv-runner-contracts\.result == 'skipped'/,
  );
  assert.doesNotMatch(deployProduction.if, /needs\.changes\.outputs\.cwv_runner/);
  assert.match(
    deployProduction.if,
    /github\.event_name == 'workflow_dispatch' \|\| needs\.changes\.outputs\.web == 'true'/,
  );
});
