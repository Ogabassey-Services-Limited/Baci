// biome-ignore-all lint/suspicious/noTemplateCurlyInString: shell fixture contains literal environment expansion
// biome-ignore-all lint/suspicious/noUselessEscapeInString: shell fixture keeps quoted case patterns explicit
// biome-ignore-all format: compact fixed-tool fixtures stay below the repository file limit
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmod, copyFile, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test, { after } from 'node:test';
const directory = path.dirname(new URL(import.meta.url).pathname);
const darwinTest = process.platform === 'darwin' ? test : test.skip;
const verifierPath = path.join(directory, 'verify-owner-cli.sh');
const dispatcherPath = path.join(directory, 'owner-dispatch.sh');
const fixtureRoots = new Set();
after(async () => { await Promise.all([...fixtureRoots].map((root) => rm(root, { force: true, recursive: true }))); });
const digest = (value) => createHash('sha256').update(value).digest('hex');
const task7Operations = ['set-auditor-private-key', 'set-auditor-app-id', 'set-auditor-client-id', 'set-auditor-installation-id', 'read-auditor-app-registration', 'read-repository-retention', 'read-rollout-ruleset', 'create-owned-probe-tag-object', 'create-owned-probe-ref', 'read-owned-probe-ref', 'rollback-owned-probe-ref', 'upsert-rollout-ruleset', 'assert-owned-probe-duplicate-create', 'assert-owned-probe-update', 'assert-owned-probe-force-update', 'assert-owned-probe-delete'];
const canonical = (value) => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && Object.getPrototypeOf(value) === Object.prototype) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
};
async function fixture(additionalChecksumRows = '') {
  const root = await mkdtemp(path.join(tmpdir(), 'baci-cwv-owner-test-'));
  fixtureRoots.add(root);
  await chmod(root, 0o700);
  const verifier = path.join(root, 'verify-owner-cli.sh');
  const dispatcher = path.join(root, 'owner-dispatch.sh');
  const fixtureVerifier = (await readFile(verifierPath, 'utf8')).replace('/private/tmp/baci-cwv-*', path.join(tmpdir(), 'baci-cwv-owner-test-*'));
  await Promise.all([writeFile(verifier, fixtureVerifier, { mode: 0o500 }), copyFile(dispatcherPath, dispatcher)]);
  await Promise.all([chmod(verifier, 0o500), chmod(dispatcher, 0o500)]);
  const archiveName = 'gh_2.93.0_macOS_arm64.zip';
  const archive = path.join(root, 'gh.tar.gz');
  const binary = path.join(root, 'tools/gh/bin/gh');
  await import('node:fs/promises').then(({ mkdir }) => mkdir(path.dirname(binary), { recursive: true, mode: 0o700 }));
  const fakeGh = Buffer.from('#!/bin/sh\n[ -z "${FAKE_GH_LOG-}" ] || printf \'%s\\n\' "$*" >>"$FAKE_GH_LOG"\nif [ "$1" = --version ]; then printf \'gh version 2.93.0 (fixture)\\nhttps://github.com/cli/cli/releases/tag/v2.93.0\\n\'; elif [ -n "${FAKE_REFUSAL-}" ]; then case "$*" in (*--include*) :;; (*) exit 72;; esac; case "$*" in (*\"--method POST\"*) docs=create-a-reference;; (*\"--method PATCH\"*) docs=update-a-reference;; (*\"--method DELETE\"*) docs=delete-a-reference;; (*) exit 73;; esac; case "$FAKE_REFUSAL" in (valid) printf \'HTTP/2.0 422 Unprocessable Entity\\r\\ncontent-type: application/json\\r\\n\\r\\n{"message":"Repository rule violations found","documentation_url":"https://docs.github.com/rest/git/refs#%s","status":"422"}\\n\' "$docs"; exit 1;; (wrong-status) printf \'HTTP/2.0 403 Forbidden\\r\\n\\r\\n{"message":"Repository rule violations found","documentation_url":"https://docs.github.com/rest/git/refs#%s","status":"403"}\\n\' "$docs"; exit 1;; (wrong-message) printf \'HTTP/2.0 422 Unprocessable Entity\\r\\n\\r\\n{"message":"Validation Failed","documentation_url":"https://docs.github.com/rest/git/refs#%s","status":"422"}\\n\' "$docs"; exit 1;; (wrong-docs) printf \'HTTP/2.0 422 Unprocessable Entity\\r\\n\\r\\n{"message":"Repository rule violations found","documentation_url":"https://docs.github.com/rest/git/refs#create-a-reference","status":"422"}\\n\'; exit 1;; (wrong-field) printf \'HTTP/2.0 422 Unprocessable Entity\\r\\n\\r\\n{"message":"Repository rule violations found","documentation_url":"https://docs.github.com/rest/git/refs#%s","status":422}\\n\' "$docs"; exit 1;; (redirect) printf \'HTTP/2.0 302 Found\\r\\nlocation: https://api.github.com/elsewhere\\r\\n\\r\\nHTTP/2.0 422 Unprocessable Entity\\r\\n\\r\\n{"message":"Repository rule violations found","documentation_url":"https://docs.github.com/rest/git/refs#%s","status":"422"}\\n\' "$docs"; exit 1;; (auth) printf \'HTTP/2.0 401 Unauthorized\\r\\n\\r\\n{"message":"Bad credentials","documentation_url":"https://docs.github.com/rest","status":"401"}\\n\'; exit 1;; (transport) exit 1;; (*) exit 75;; esac; elif printf \'%s\' "$*" | /usr/bin/grep -q -- \'--method GET.*rulesets\'; then case "$*" in (*\'?per_page=100&page=1\'*) page=1;; (*\'?per_page=100&page=2\'*) page=2;; (*\'?per_page=100&page=3\'*) page=3;; (*) exit 74;; esac; case "${FAKE_RULESET_MODE-}:$page" in (existing-page-2:1) printf \'[{"id":7,"name":"other"}]\\n\';; (existing-page-2:2) printf \'[{"id":17,"name":"ogabassey-rollout-progress-immutable"}]\\n\';; (existing-page-2:3) printf \'[]\\n\';; (duplicate-pages:1) printf \'[{"id":17,"name":"ogabassey-rollout-progress-immutable"}]\\n\';; (duplicate-pages:2) printf \'[{"id":19,"name":"ogabassey-rollout-progress-immutable"}]\\n\';; (duplicate-pages:3) printf \'[]\\n\';; (*:1) printf \'[]\\n\';; (*) exit 75;; esac; elif printf \'%s\' "$*" | /usr/bin/grep -q -- \'--method PATCH.*rulesets/17\'; then printf \'{"id":17}\\n\'; elif printf \'%s\' "$*" | /usr/bin/grep -q -- \'--method POST.*rulesets\'; then printf \'{"id":18}\\n\'; elif printf \'%s\' "$*" | /usr/bin/grep -q \'/git/tags\'; then printf \'{"sha":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"}\\n\'; elif printf \'%s\' "$*" | /usr/bin/grep -q \'probe-2-ref-request.json\'; then printf \'{"ref":"refs/tags/ogabassey-semantic-admission/h0-runner-ruleset-probe-v1","object":{"sha":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"}}\\n\'; else printf \'%s\\n\' "$*"; fi\n');
  await Promise.all([writeFile(binary, fakeGh, { mode: 0o500 }), writeFile(archive, 'fixture archive', { mode: 0o400 })]);
  const archiveSha256 = digest(await readFile(archive));
  const checksums = path.join(root, 'gh-checksums.txt');
  const checksumBytes = Buffer.from(`${archiveSha256}  ${archiveName}\n${additionalChecksumRows}`);
  await writeFile(checksums, checksumBytes, { mode: 0o400 });
  const policy = path.join(root, 'policy.json');
  const policyBytes = Buffer.from(canonical({
      repository: { id: 1100488586, name: 'ogabasseyy/Baci' },
      authority: { implementationBaseSha: 'a'.repeat(40) },
      ruleset: {
        bypassActors: [], enforcement: 'active', name: 'ogabassey-rollout-progress-immutable', rules: ['update', 'deletion'],
        tagExcludes: [], tagIncludes: ['refs/tags/ogabassey-rollout-claim/*', 'refs/tags/ogabassey-rollout-progress/**/*', 'refs/tags/ogabassey-semantic-admission/*'], target: 'tag',
      },
      supplyChain: { node: { ownerDarwinArm64Sha256: '1'.repeat(64), version: '24.18.0' } },
      supplyChainProvenance: { ownerCli: { archiveSha256, binarySha256: digest(fakeGh), checksumsSha256: digest(checksumBytes), version: '2.93.0' } },
    }));
  await writeFile(policy, policyBytes, { mode: 0o400 });
  const sourceManifest = path.join(root, 'source-manifest.json');
  const manifestBytes = Buffer.from(canonical({
      policyFileSha256: digest(policyBytes),
      schema: 'preflight-v1',
      sourceArchive: {
        entries: [{ mode: '100755', path: 'infra/cwv-runner/owner-dispatch.sh', sha256: digest(await readFile(dispatcher)) }, { mode: '100644', path: 'infra/cwv-runner/policy.json', sha256: digest(policyBytes) }, { mode: '100755', path: 'infra/cwv-runner/verify-owner-cli.sh', sha256: digest(await readFile(verifier)) }],
      },
    }));
  await writeFile(sourceManifest, manifestBytes, { mode: 0o400 });
  return {
    archive,
    binary,
    checksums,
    dispatcher,
    manifestSha256: digest(manifestBytes),
    policy,
    root,
    sourceManifest,
    verifier,
  };
}
test('creates owner verifier fixtures in the runtime temporary directory', async () => { const value = await fixture(); assert.equal(path.dirname(value.root), tmpdir()); });
function run(file, args, input, extraEnv = {}) {
  return spawnSync(file, args, {
    encoding: 'utf8',
    env: { ...extraEnv, LC_ALL: 'C', PATH: '/hostile/path', TZ: 'UTC' },
    input,
  });
}
test('uses only fixed macOS tools and exposes the closed verifier modes', async () => {
  const [verifier, dispatcher] = await Promise.all([
    readFile(verifierPath, 'utf8'),
    readFile(dispatcherPath, 'utf8'),
  ]);
  for (const mode of ['--verify-source', '--verify-only', '--exec-gh-operation'])
    assert.match(verifier, new RegExp(mode));
  for (const tool of ['/usr/bin/plutil', '/usr/bin/shasum', '/usr/bin/stat'])
    assert.match(verifier, new RegExp(tool));
  assert.doesNotMatch(verifier, /command -v|\/opt\/homebrew|\beval\b|--input -/);
  assert.doesNotMatch(verifier, /--paginate|--slurp/);
  assert.match(verifier, /Repository rule violations found/);
  assert.match(verifier, /create-a-reference.*update-a-reference.*delete-a-reference/s);
  assert.doesNotMatch(verifier, /expect_refusal\(\).*\/dev\/null/);
  assert.doesNotMatch(dispatcher, /gh --paginate/); const evalSites = dispatcher.match(/"\$node" --input-type=module --eval '[^']+'[^\n]*3<"\$manifest"/g) ?? []; assert.equal(evalSites.length, 2); for (const site of evalSites) assert.match(site, /fstatSync\(3\).*lstatSync\(manifest\).*same\(held,current\).*readFileSync\(3\).*data:text\/javascript;base64.*runTask9SourceAuthorizationCli/s); assert.doesNotMatch(evalSites.reduce((source, site) => source.replace(site, ''), dispatcher), /\beval\b/);
  assert.match(dispatcher, /--prepare-task9-bootstrap-node/);
  assert.match(dispatcher, /--task9-operation/);
  const preparation = dispatcher.slice(
    dispatcher.indexOf('prepare_gh()'),
    dispatcher.indexOf('task9()')
  );
  assert.doesNotMatch(preparation, /auth token|GITHUB_TOKEN|GH_TOKEN/);
  assert.match(dispatcher, /--emit-task9-token[\s\S]*"--token-fd","0"/);
  assert.doesNotMatch(dispatcher, /"\$gh" auth token/);
  assert.match(verifier, /ruleset\.rules\.0.*= update.*ruleset\.rules\.1.*= deletion/);
  assert.doesNotMatch(verifier, /"type":"creation"|= creation/);
  assert.match(verifier, /private-key\.pem.*<"\$input"/); assert.match(verifier, /case "\$root" in \(\/private\/tmp\/baci-cwv-\*\)/);
  for (const operation of task7Operations.slice(8)) assert.match(verifier, new RegExp(operation));
});
test('claims both source-authorization destinations without mv no-clobber ambiguity', async () => { const verifier = await readFile(verifierPath, 'utf8'); for (const writer of [verifier.slice(verifier.indexOf('write_atomic()'), verifier.indexOf('\nwrite_digest()')), verifier.slice(verifier.indexOf('write_digest()'), verifier.indexOf('\noperation_set()'))]) { assert.match(writer, /\/bin\/ln "\$temporary" "\$destination" \|\| refuse/); assert.match(writer, /\/bin\/rm -f -- "\$temporary" \|\| refuse/); assert.doesNotMatch(writer, /\/bin\/mv -n/); } });
darwinTest('creates and revalidates one task7 source authorization', async () => {
  const value = await fixture();
  const receipt = path.join(value.root, 'source-authorization.json');
  const receiptDigest = path.join(value.root, 'source-authorization.sha256');
  const result = run(value.verifier, [
    '--verify-source',
    '--manifest',
    value.sourceManifest,
    '--manifest-sha256',
    value.manifestSha256,
    '--policy',
    value.policy,
    '--dispatcher',
    value.dispatcher,
    '--verifier',
    value.verifier,
    '--purpose',
    'task7-provisioning',
    '--output-receipt',
    receipt,
    '--output-digest',
    receiptDigest,
  ]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal((await stat(receipt)).mode & 0o777, 0o400);
  assert.equal((await readFile(receiptDigest, 'utf8')).trim(), digest(await readFile(receipt)));
  assert.deepEqual(JSON.parse(await readFile(receipt, 'utf8')), {
    generation: 0,
    operationSet: task7Operations,
    operationSetDigest: digest(JSON.stringify(task7Operations)),
    policyFileSha256: digest(await readFile(value.policy)),
    provenance: { manifestSha256: value.manifestSha256, nodeProvenanceSha256: null, runtimeSha256: null, sourceArchiveSha256: null },
    purpose: 'task7-provisioning', schemaVersion: 1, sourceBinding: null,
    sourceHashes: { bootstrapSha256: null, dispatcherSha256: digest(await readFile(value.dispatcher)), transportSha256: null, verifierSha256: digest(await readFile(value.verifier)) },
    transactionId: path.basename(value.root),
  });
});
darwinTest('verifies archive, checksum row, binary, and version before rebound exec', async () => {
  const value = await fixture(`${'b'.repeat(64)}  unrelated-release.zip\n`);
  const sourceReceipt = path.join(value.root, 'source-authorization.json');
  const sourceDigest = path.join(value.root, 'source-authorization.sha256');
  assert.equal(
    run(value.verifier, [
      '--verify-source', '--manifest', value.sourceManifest,
      '--manifest-sha256', value.manifestSha256, '--policy', value.policy,
      '--dispatcher', value.dispatcher, '--verifier', value.verifier,
      '--purpose', 'task7-provisioning', '--output-receipt', sourceReceipt,
      '--output-digest', sourceDigest,
    ]).status,
    0
  );
  const receipt = path.join(value.root, 'gh-receipt.json');
  const common = [
    '--policy', value.policy, '--checksum-file', value.checksums,
    '--archive', value.archive, '--receipt', receipt,
    '--source-authorization', sourceReceipt,
    '--source-authorization-sha256', sourceDigest,
    '--purpose', 'task7-provisioning',
  ];
  const verified = run(value.verifier, [...common, '--verify-only']);
  assert.equal(verified.status, 0, verified.stderr);
  const executed = run(value.verifier, [
    ...common,
    '--exec-gh-operation',
    'read-repository-retention',
  ]);
  assert.equal(executed.status, 0, executed.stderr);
  assert.match(executed.stdout, /^api --method GET /);
  const ruleset = run(value.verifier, [
    ...common,
    '--exec-gh-operation',
    'upsert-rollout-ruleset',
  ]);
  assert.equal(ruleset.status, 0, ruleset.stderr);
  assert.deepEqual(JSON.parse(ruleset.stdout), { id: 18 });
  assert.deepEqual(JSON.parse(await readFile(path.join(value.root, 'ruleset-request.json'), 'utf8')), {
    bypass_actors: [], conditions: { ref_name: { exclude: [], include: ['refs/tags/ogabassey-rollout-claim/*', 'refs/tags/ogabassey-rollout-progress/**/*', 'refs/tags/ogabassey-semantic-admission/*'] } }, enforcement: 'active', name: 'ogabassey-rollout-progress-immutable', rules: [{ type: 'update' }, { type: 'deletion' }], target: 'tag',
  });
  const tag = run(value.verifier, [...common, '--exec-gh-operation', 'create-owned-probe-tag-object', '--probe-id', '2']);
  assert.equal(tag.status, 0, tag.stderr);
  const probe = run(value.verifier, [...common, '--exec-gh-operation', 'create-owned-probe-ref', '--probe-id', '2']);
  assert.equal(probe.status, 0, probe.stderr);
  assert.deepEqual(JSON.parse(await readFile(path.join(value.root, 'probe-2-tag-request.json'), 'utf8')), { message: 'H0 runner ruleset probe', object: 'a'.repeat(40), tag: 'ogabassey-semantic-admission/h0-runner-ruleset-probe-v1', type: 'commit' });
  assert.deepEqual(JSON.parse(await readFile(path.join(value.root, 'probe-2-ref-request.json'), 'utf8')), { ref: 'refs/tags/ogabassey-semantic-admission/h0-runner-ruleset-probe-v1', sha: 'b'.repeat(40) });
  await Promise.all(['ruleset-activated.json', 'ruleset-binding.json', 'ruleset-list-1.json', 'ruleset-request.json', 'ruleset-response.json'].map((name) => rm(path.join(value.root, name))));
  const ghLog = path.join(value.root, 'gh-calls.log');
  const existing = run(value.verifier, [...common, '--exec-gh-operation', 'upsert-rollout-ruleset'], undefined, { FAKE_GH_LOG: ghLog, FAKE_RULESET_MODE: 'existing-page-2' });
  assert.equal(existing.status, 0, existing.stderr);
  assert.deepEqual(JSON.parse(existing.stdout), { id: 17 });
  assert.equal((await readFile(ghLog, 'utf8')).match(/--method POST.*\/rulesets(?:\s|$)/g)?.length ?? 0, 0);
  assert.equal((await readFile(ghLog, 'utf8')).match(/--method PATCH.*\/rulesets\/17(?:\s|$)/g)?.length, 1);
  assert.deepEqual(JSON.parse(await readFile(path.join(value.root, 'ruleset-binding.json'), 'utf8')), { id: 17, requestSha256: digest(await readFile(path.join(value.root, 'ruleset-request.json'))) });
  for (const [id, ref] of ['refs/tags/ogabassey-rollout-claim/h0-runner-ruleset-probe-v1', 'refs/tags/ogabassey-rollout-progress/h0-runner-ruleset-probe-v1/start'].entries()) await Promise.all([writeFile(path.join(value.root, `probe-${id}-ref-response.json`), canonical({ ref, object: { sha: 'c'.repeat(40) } }), { mode: 0o400 }), writeFile(path.join(value.root, `task7-probe-${id}.json`), canonical({ schemaVersion: 1, policyFileSha256: digest(await readFile(value.policy)), sourceAuthorizationSha256: digest(await readFile(sourceReceipt)), ref, targetSha: 'a'.repeat(40), objectSha: 'c'.repeat(40) }), { mode: 0o400 })]);
  await writeFile(path.join(value.root, 'task7-probe-2.json'), canonical({ schemaVersion: 1, policyFileSha256: digest(await readFile(value.policy)), sourceAuthorizationSha256: digest(await readFile(sourceReceipt)), ref: 'refs/tags/ogabassey-semantic-admission/h0-runner-ruleset-probe-v1', targetSha: 'a'.repeat(40), objectSha: 'b'.repeat(40) }), { mode: 0o400 });
  const readProbe = run(value.verifier, [...common, '--exec-gh-operation', 'read-owned-probe-ref', '--probe-id', '1']);
  assert.equal(readProbe.status, 0, readProbe.stderr);
  assert.match(readProbe.stdout, /tags\/ogabassey-rollout-progress\/h0-runner-ruleset-probe-v1\/start/);
  for (const operation of task7Operations.slice(-4)) assert.equal(run(value.verifier, [...common, '--exec-gh-operation', operation, '--probe-id', '1'], undefined, { FAKE_REFUSAL: 'valid' }).status, 0, operation);
  for (const [failure, operation, id] of [['wrong-status', 'assert-owned-probe-delete', '0'], ['wrong-message', 'assert-owned-probe-update', '0'], ['wrong-docs', 'assert-owned-probe-force-update', '0'], ['wrong-field', 'assert-owned-probe-duplicate-create', '0'], ['redirect', 'assert-owned-probe-delete', '2'], ['auth', 'assert-owned-probe-update', '2'], ['transport', 'assert-owned-probe-force-update', '2']]) assert.notEqual(run(value.verifier, [...common, '--exec-gh-operation', operation, '--probe-id', id], undefined, { FAKE_REFUSAL: failure }).status, 0, failure);
  assert.notEqual(run(value.verifier, [...common, '--exec-gh-operation', 'create-owned-probe-ref', '--probe-id', 'other']).status, 0);
  const key = path.join(value.root, 'private-key.pem');
  await writeFile(key, '-----BEGIN PRIVATE KEY-----\nfixture\n-----END PRIVATE KEY-----\n', { mode: 0o600 });
  assert.match(run(value.verifier, [...common, '--exec-gh-operation', 'set-auditor-private-key']).stdout, /secret set BACI_CWV_RUNNER_AUDITOR_PRIVATE_KEY/);
  await chmod(key, 0o400);
  assert.notEqual(run(value.verifier, [...common, '--exec-gh-operation', 'set-auditor-private-key']).status, 0);
  const clientId = path.join(value.root, 'auditor-client-id');
  for (const clientValue of ['Iv1.a2B3c4D5e6F7g8H9', 'Iv1a2B3c4D5e6F7g8H9', `Iv1.${'A'.repeat(124)}`]) {
    await rm(clientId, { force: true }); await writeFile(clientId, `${clientValue}\n`, { mode: 0o400 }); const acceptedClient = run(value.verifier, [...common, '--exec-gh-operation', 'set-auditor-client-id']);
    assert.equal(acceptedClient.status, 0, acceptedClient.stderr); assert.match(acceptedClient.stdout, /variable set BACI_CWV_RUNNER_AUDITOR_CLIENT_ID/); assert.doesNotMatch(acceptedClient.stdout, new RegExp(clientValue.replace('.', '\\.')));
  }
  for (const invalid of ['', ' Iv1.abc', 'Iv1.abc ', 'Iv1.abc def', '.Iv1abc', 'Iv1.', 'Iv1..abc', 'Iv1.abc-def', 'Iv1./etc', 'Iv1.\u0001abc', 'Iv1.abc\nsecond', `ghp_${'s'.repeat(36)}`, `Iv1.${'A'.repeat(125)}`]) { await chmod(clientId, 0o600); await writeFile(clientId, `${invalid}\n`); await chmod(clientId, 0o400); const refused = run(value.verifier, [...common, '--exec-gh-operation', 'set-auditor-client-id']); assert.notEqual(refused.status, 0, JSON.stringify(invalid)); assert.equal(refused.stdout, '', JSON.stringify(invalid)); }
  for (const [name, operation] of [['auditor-app-id', 'set-auditor-app-id'], ['auditor-installation-id', 'set-auditor-installation-id']]) { const input = path.join(value.root, name); await writeFile(input, '123\n', { mode: 0o400 }); assert.equal(run(value.verifier, [...common, '--exec-gh-operation', operation]).status, 0, operation); await chmod(input, 0o600); await writeFile(input, 'Iv123\n'); await chmod(input, 0o400); const refused = run(value.verifier, [...common, '--exec-gh-operation', operation]); assert.notEqual(refused.status, 0, operation); assert.equal(refused.stdout, '', operation); }
  await Promise.all(['ruleset-activated.json', 'ruleset-binding.json', 'ruleset-list-1.json', 'ruleset-list-2.json', 'ruleset-list-3.json', 'ruleset-request.json', 'ruleset-response.json'].map((name) => rm(path.join(value.root, name), { force: true })));
  const duplicateLog = path.join(value.root, 'gh-duplicate-calls.log');
  const duplicate = run(value.verifier, [...common, '--exec-gh-operation', 'upsert-rollout-ruleset'], undefined, { FAKE_GH_LOG: duplicateLog, FAKE_RULESET_MODE: 'duplicate-pages' });
  assert.notEqual(duplicate.status, 0);
  assert.doesNotMatch(await readFile(duplicateLog, 'utf8'), /--method (?:POST|PATCH).*\/rulesets(?:\/|\s|$)/);

  await chmod(value.binary, 0o700);
  await writeFile(value.binary, '#!/bin/sh\nprintf bad\n');
  await chmod(value.binary, 0o500);
  const replaced = run(value.verifier, [
    ...common,
    '--exec-gh-operation',
    'read-repository-retention',
  ]);
  assert.notEqual(replaced.status, 0);
});
test('refuses wrong purpose, arbitrary operation, caller argv, and checksum drift', async () => {
  const source = await readFile(verifierPath, 'utf8');
  assert.match(source, /task7-provisioning/);
  assert.match(source, /task9-exact-run/);
  assert.doesNotMatch(source, /"\$@".*gh|gh.*"\$@"/);
  const value = await fixture();
  await chmod(value.checksums, 0o600);
  await writeFile(value.checksums, `${'0'.repeat(64)}  gh_2.93.0_macOS_arm64.zip\n`);
  const result = run(value.verifier, [
    '--policy', value.policy,
    '--checksum-file', value.checksums,
    '--archive', value.archive,
    '--receipt', path.join(value.root, 'gh-receipt.json'),
    '--source-authorization', path.join(value.root, 'missing.json'),
    '--source-authorization-sha256', path.join(value.root, 'missing.sha256'),
    '--purpose', 'task7-provisioning',
    '--exec-gh-operation', 'dispatch-exact-run', '--endpoint', 'example.test',
  ]);
  assert.notEqual(result.status, 0);
  assert.equal(result.stdout, '');
});
darwinTest('emits a Task 9 token only after immediate source and binary rebound, rejecting a Task 7 receipt', async () => {
  const value = await fixture();
  const sourceReceipt = path.join(value.root, 'source-authorization.json');
  const sourceDigest = path.join(value.root, 'source-authorization.sha256');
  const operations = ['list-attestation-runs', 'dispatch-exact-run', 'read-exact-run', 'cancel-exact-run', 'read-failed-job-evidence', 'rerun-failed-exact-run', 'list-runner-inventory', 'read-exact-job', 'list-exact-artifacts', 'download-exact-artifact'];
  const sourceAuthorization = { generation: 1, operationSet: operations, operationSetDigest: digest(JSON.stringify(operations)), policyFileSha256: digest(await readFile(value.policy)), provenance: { manifestSha256: 'a'.repeat(64), nodeProvenanceSha256: 'b'.repeat(64), runtimeSha256: 'c'.repeat(64), sourceArchiveSha256: 'd'.repeat(64) }, purpose: 'task9-exact-run', schemaVersion: 1, sourceBinding: { base: { ref: 'refs/heads/main', sha: 'e'.repeat(40) }, deploymentSha: 'f'.repeat(40), exactRun: { admissionId: '1'.repeat(64), workflow: { id: 2, path: '.github/workflows/cwv-runner-attestation.yml', ref: 'refs/heads/main' } }, mergeSha: '2'.repeat(40), pullRequest: { headRef: 'h0/task9', number: 9 }, ref: 'refs/pull/9/merge', repository: { id: 1100488586, name: 'ogabasseyy/Baci' }, reviewedSha: '3'.repeat(40) }, sourceFiles: [{ path: 'infra/cwv-runner/owner-dispatch.sh', sha256: digest(await readFile(value.dispatcher)) }, { path: 'infra/cwv-runner/verify-owner-cli.sh', sha256: digest(await readFile(value.verifier)) }], transactionId: path.basename(value.root) };
  await writeFile(sourceReceipt, canonical(sourceAuthorization), { mode: 0o400 });
  await writeFile(sourceDigest, `${digest(await readFile(sourceReceipt))}\n`, { mode: 0o400 });
  const authorizedRoot = path.join(
    value.root,
    'authorized-source/infra/cwv-runner'
  );
  await import('node:fs/promises').then(({ mkdir }) =>
    mkdir(authorizedRoot, { recursive: true, mode: 0o700 })
  );
  await Promise.all([
    copyFile(value.dispatcher, path.join(authorizedRoot, 'owner-dispatch.sh')),
    copyFile(value.policy, path.join(authorizedRoot, 'policy.json')),
    copyFile(value.verifier, path.join(authorizedRoot, 'verify-owner-cli.sh')),
  ]);
  const common = [
    '--policy', path.join(authorizedRoot, 'policy.json'), '--checksum-file', value.checksums,
    '--archive', value.archive, '--receipt', path.join(value.root, 'gh-receipt.json'),
    '--source-authorization', sourceReceipt,
    '--source-authorization-sha256', sourceDigest, '--purpose', 'task9-exact-run',
  ];
  assert.equal(run(value.verifier, [...common, '--verify-only']).status, 0);
  const token = run(value.verifier, [...common, '--emit-task9-token']);
  assert.equal(token.status, 0, token.stderr);
  assert.equal(token.stdout, 'auth token\n');
  const drift = { ...sourceAuthorization, purpose: 'task7-provisioning' };
  await chmod(sourceReceipt, 0o600);
  await chmod(sourceDigest, 0o600);
  await writeFile(sourceReceipt, canonical(drift), { mode: 0o400 });
  await writeFile(sourceDigest, `${digest(await readFile(sourceReceipt))}\n`, { mode: 0o400 });
  assert.notEqual(run(value.verifier, [...common, '--emit-task9-token']).status, 0);
});
