import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

const root = new URL('.', import.meta.url);
const script = new URL('./retire-ollama.sh', root);
const execFileAsync = promisify(execFile);

async function scannedContainers(rows) {
  const dir = await mkdtemp(join(tmpdir(), 'baci-ollama-container-scan-'));
  const bin = join(dir, 'bin');
  try {
    await mkdir(bin);
    const docker = join(bin, 'docker');
    await writeFile(
      docker,
      `#!/bin/sh\ncase "$*" in *' ps '*) printf '%s\\n' '${rows
        .map(({ id }) => id)
        .join(' ')}' | tr ' ' '\\n';; *inspect*) case "$*" in ${rows
        .map(({ id, detail }) => `*${id}*) printf '%s\\n' '${detail}' ;;`)
        .join(' ')} esac;; esac\n`
    );
    await execFileAsync('chmod', ['0755', docker]);
    const { stdout } = await execFileAsync(
      'sh',
      [
        '-c',
        '. "$1"; init_temp_root; trap cleanup_temp EXIT; CANONICAL_DOCKER_SOCKET=/tmp/docker.sock; scan_container_rows all',
        'retire-ollama-container-test',
        script.pathname,
      ],
      { env: { ...process.env, RETIRE_OLLAMA_TEST_BIN: bin } }
    );
    return stdout.trim();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const scan = ({ unitState, timerState, container, records }) => ({
  units: [
    { name: 'ollama.service', state: unitState },
    { name: 'ollama-watchdog.timer', state: timerState },
  ],
  container,
  model: { treeSha256: 'model-before-delete', byteCount: '4096' },
  records,
});

const records = (systemdDefinitions, changingSuffix) => [
  { class: 'systemd-definitions', sha256: systemdDefinitions },
  { class: 'systemd-fragments', sha256: 'unit-definition' },
  { class: 'running-processes', sha256: `processes-${changingSuffix}` },
  { class: 'systemd-timers', sha256: `timers-${changingSuffix}` },
  { class: 'running-containers', sha256: `running-${changingSuffix}` },
  { class: 'container-definitions', sha256: `containers-${changingSuffix}` },
  { class: 'container-config', sha256: `config-${changingSuffix}` },
  { class: 'model-store-identity', treeSha256: 'model-before-delete' },
];

async function sameDeleteModelsView(baseline, current) {
  const dir = await mkdtemp(join(tmpdir(), 'baci-ollama-stateful-'));
  const before = join(dir, 'before.json');
  const after = join(dir, 'after.json');
  const beforeNormalized = join(dir, 'before.normalized.json');
  const afterNormalized = join(dir, 'after.normalized.json');
  try {
    await Promise.all([
      writeFile(before, JSON.stringify(baseline)),
      writeFile(after, JSON.stringify(current)),
    ]);
    await execFileAsync('sh', [
      '-c',
      '. "$1"; normalize_revalidation_snapshot "$2" "$3" delete_models; normalize_revalidation_snapshot "$4" "$5" delete_models; cmp -s "$3" "$5"',
      'retire-ollama-stateful-test',
      script.pathname,
      before,
      beforeNormalized,
      after,
      afterNormalized,
    ]);
    return true;
  } catch (error) {
    if (error.code === 1) return false;
    throw error;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function deleteVerifiedModels() {
  const dir = await mkdtemp(join(tmpdir(), 'baci-ollama-model-delete-'));
  const store = join(dir, 'store');
  const receipt = join(dir, 'receipt.json');
  try {
    await mkdir(store);
    await writeFile(join(store, 'model.bin'), 'retire me');
    await writeFile(
      receipt,
      JSON.stringify({ scan: { model: { treeSha256: 'model-before-delete' } } })
    );
    await execFileAsync('sh', [
      '-c',
      '. "$1"; STORE="$2"; RECEIPT="$3"; model_identity() { printf "model-before-delete\\n"; }; assert_postcondition() { [ "$1" = delete_models ] && [ ! -e "$STORE" ]; }; delete_models',
      'retire-ollama-model-delete-test',
      script.pathname,
      store,
      receipt,
    ]);
    await assert.rejects(readFile(join(store, 'model.bin')));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test('accepts the active-to-disabled, container-removed state before model deletion', async () => {
  const baseline = scan({
    unitState: 'loaded:enabled:active',
    timerState: 'loaded:enabled:active',
    container: { name: 'ollama-loopback', fullId: 'before' },
    records: records('systemd-unchanged', 'before'),
  });
  const afterDisableAndRemoval = scan({
    unitState: 'loaded:disabled:inactive',
    timerState: 'loaded:disabled:inactive',
    container: { name: 'ollama-loopback', fullId: 'removed' },
    records: records('systemd-unchanged', 'after-removal'),
  });

  assert.equal(
    await sameDeleteModelsView(baseline, afterDisableAndRemoval),
    true
  );
  await deleteVerifiedModels();
});

test('retains unrelated authority drift detection before model deletion', async () => {
  const baseline = scan({
    unitState: 'loaded:enabled:active',
    timerState: 'loaded:enabled:active',
    container: { name: 'ollama-loopback', fullId: 'before' },
    records: records('systemd-unchanged', 'before'),
  });
  const mutatedAuthority = scan({
    unitState: 'loaded:disabled:inactive',
    timerState: 'loaded:disabled:inactive',
    container: { name: 'ollama-loopback', fullId: 'removed' },
    records: records('systemd-drifted', 'after-removal'),
  });

  assert.equal(await sameDeleteModelsView(baseline, mutatedAuthority), false);
});

test('does not classify an unrelated Baci container as an Ollama consumer', async () => {
  assert.equal(
    await scannedContainers([
      { id: 'baci-web', detail: 'baci-web baci/app [] [] {}' },
    ]),
    ''
  );
});

test('ignores an unrelated container that disappears during inspect', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'baci-ollama-container-race-'));
  const bin = join(dir, 'bin');
  const state = join(dir, 'ps-seen');
  try {
    await mkdir(bin);
    await writeFile(
      join(bin, 'docker'),
      '#!/bin/sh\ncase "$*" in *\' ps \'*) if [ ! -e "$RETIRE_OLLAMA_TEST_STATE" ]; then : >"$RETIRE_OLLAMA_TEST_STATE"; printf "gone\\nkept\\n"; else printf "kept\\n"; fi;; *\' inspect \'*gone) exit 1;; *\' inspect \'*kept) printf "kept image [] [] {} {}\\n";; esac\n'
    );
    await execFileAsync('chmod', ['0755', join(bin, 'docker')]);
    const { stdout } = await execFileAsync(
      'sh',
      [
        '-c',
        '. "$1"; init_temp_root; trap cleanup_temp EXIT; CANONICAL_DOCKER_SOCKET=/tmp/docker.sock; scan_container_rows all',
        'retire-ollama-container-race-test',
        script.pathname,
      ],
      {
        env: {
          ...process.env,
          RETIRE_OLLAMA_TEST_BIN: bin,
          RETIRE_OLLAMA_TEST_STATE: state,
        },
      }
    );
    assert.equal(stdout, '');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('classifies a container with an Ollama endpoint as a consumer', async () => {
  assert.match(
    await scannedContainers([
      {
        id: 'baci-worker',
        detail:
          'baci-worker baci/app [OLLAMA_HOST=http://127.0.0.1:11434] [] {}',
      },
    ]),
    /OLLAMA_HOST/
  );
});
