import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { canonicalJson } from './canonical-json.mjs';
import { configureImageProjection } from './image-projection-config.mjs';
import { parseRunnerPolicy } from './policy.schema.mjs';

const policyBytes = readFileSync(new URL('policy.json', import.meta.url));
const policy = parseRunnerPolicy(JSON.parse(policyBytes));
const hash = (value) => createHash('sha256').update(value).digest('hex');
const sourceSha = 'a'.repeat(64);
const layers = [`sha256:${'b'.repeat(64)}`];
const validate = configureImageProjection(policy, policyBytes, hash);
const labels = {
  'io.baci.cwv.chrome-version': policy.supplyChain.chrome.version,
  'io.baci.cwv.node-version': policy.supplyChain.node.version,
  'io.baci.cwv.pnpm-version': policy.supplyChain.pnpm.version,
  'io.baci.cwv.policy-canonical-sha256': hash(canonicalJson(policy)),
  'io.baci.cwv.policy-file-sha256': hash(policyBytes),
  'io.baci.cwv.provenance-schema': '1',
  'io.baci.cwv.runner-version': policy.supplyChain.runner.version,
  'io.baci.cwv.source-manifest-sha256': sourceSha,
};
const buildkitRow = (createdBy, emptyLayer = true) => ({
  created: '2026-07-21T00:00:00.000000000Z',
  created_by: `${createdBy} # buildkit`,
  comment: 'buildkit.dockerfile.v0',
  ...(emptyLayer ? { empty_layer: true } : {}),
});

function fixture() {
  return {
    architecture: 'amd64',
    config: {
      Entrypoint: ['/opt/baci-cwv/entrypoint.sh'],
      Env: [
        'PATH=/opt/node/bin:/opt/pnpm/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
        'LANG=C.UTF-8',
        'LC_ALL=C.UTF-8',
        'TZ=Etc/UTC',
      ],
      Labels: labels,
      User: 'runner',
      WorkingDir: '/runner-work',
    },
    history: [
      buildkitRow('COPY /runtime-root/ /', false),
      buildkitRow(`LABEL io.baci.cwv.source-manifest-sha256=${sourceSha}`),
      buildkitRow(
        'ENV PATH=/opt/node/bin:/opt/pnpm/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin LANG=C.UTF-8 LC_ALL=C.UTF-8 TZ=Etc/UTC'
      ),
      buildkitRow('USER runner'),
      buildkitRow('WORKDIR /runner-work'),
      buildkitRow('ENTRYPOINT ["/opt/baci-cwv/entrypoint.sh"]'),
    ],
    os: 'linux',
    rootfs: { diff_ids: layers, type: 'layers' },
  };
}

test('rejects extra config envelope keys and unsafe history before runtime projection', () => {
  assert.doesNotThrow(() => validate(fixture(), sourceSha, layers));
  assert.throws(() =>
    validate({ ...fixture(), extra: true }, sourceSha, layers)
  );
  const history = [{ created_by: 'RUN TOKEN=leak' }, ...fixture().history];
  assert.throws(() => validate({ ...fixture(), history }, sourceSha, layers));
});

test('permits only an absent or null final-image Cmd', () => {
  const withNullCmd = fixture();
  withNullCmd.config.Cmd = null;
  assert.doesNotThrow(() => validate(withNullCmd, sourceSha, layers));

  for (const Cmd of [[], ['node'], '', {}]) {
    const invalid = fixture();
    invalid.config.Cmd = Cmd;
    assert.throws(() => validate(invalid, sourceSha, layers));
  }
});

test('requires each normalized BuildKit final-image row exactly once and in order', () => {
  for (const mutate of [
    (history) => history.slice(1),
    (history) => [...history, history[0]],
    (history) => [history[1], history[0], ...history.slice(2)],
    (history) =>
      history.map((row, index) =>
        index === 2
          ? { ...row, created_by: `${row.created_by} TOKEN=leak` }
          : row
      ),
    (history) =>
      history.map((row, index) =>
        index === 0 ? { ...row, empty_layer: true } : row
      ),
  ]) {
    const history = mutate(fixture().history);
    assert.throws(() => validate({ ...fixture(), history }, sourceSha, layers));
  }
});

test('each projection validator retains its original hash authority', () => {
  const first = configureImageProjection(policy, policyBytes, hash);
  configureImageProjection(policy, policyBytes, () => '0'.repeat(64));

  assert.doesNotThrow(() => first(fixture(), sourceSha, layers));
});
