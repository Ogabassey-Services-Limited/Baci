// biome-ignore-all format: descriptor fixtures stay below the repository file limit
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmodSync,
  closeSync,
  existsSync,
  fstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { TRANSPORT_SOURCE_FILES } from './owner-api-transport-source.mjs';
import * as sourceAuthorization from './task9-source-authorization.mjs';

const hash = (value) => createHash('sha256').update(value).digest('hex');
const canonical = (value) =>
  `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${JSON.stringify(value[key])}`)
    .join(',')}}`;
const artifactDownload = { allowedQueryKeys: 'rscd|rsct|se|sig|ske|skoid|sks|skt|sktid|skv|sp|spr|sr|st|sv', bodyInactivityTimeoutSeconds: 10, connectTimeoutSeconds: 10, headerTimeoutSeconds: 10, hostPattern: '^productionresultssa[0-9]+\\.blob\\.core\\.windows\\.net$', maxBytes: 1_048_576, overallTimeoutSeconds: 30, pathPrefix: '/actions-results/' };
function installPolicy(sourceRoot, value = artifactDownload) {
  const path = join(sourceRoot, 'infra/cwv-runner/policy.json');
  mkdirSync(join(sourceRoot, 'infra/cwv-runner'), { recursive: true });
  const bytes = Buffer.from(JSON.stringify({ repositoryAuthority: { artifactDownload: value } }));
  writeFileSync(path, bytes, { mode: 0o400 });
  return { bytes, path, sha256: hash(bytes) };
}
test('rehashes each authorized Task 9 member through descriptor-checked reads', () => {
  const root = mkdtempSync(join(tmpdir(), 'task9-source-authorization-'));
  try {
    const source = join(root, 'authorized-source/infra/cwv-runner');
    const sourceRoot = join(root, 'authorized-source');
    mkdirSync(source, { recursive: true });
    const policy = installPolicy(sourceRoot);
    const payload = Buffer.from('sealed');
    const member = join(source, 'owner-dispatch.sh');
    writeFileSync(member, payload, { mode: 0o755 });
    chmodSync(member, 0o755);
    const receipt = Buffer.from(
      canonical({
        policyFileSha256: policy.sha256,
        purpose: 'task9-exact-run',
        sourceFiles: [
          { path: 'infra/cwv-runner/owner-dispatch.sh', sha256: hash(payload) },
        ],
      })
    );
    const authorization = join(root, 'source-authorization.json');
    const digest = join(root, 'source-authorization.sha256');
    writeFileSync(authorization, receipt);
    writeFileSync(digest, `${hash(receipt)}\n`);
    assert.equal(
      sourceAuthorization.verifyTask9Source({
        authorizationPath: authorization,
        authorizationSha256Path: digest,
        sourceRoot,
      }),
      hash(receipt)
    );
    const replacement = join(source, 'replacement');
    writeFileSync(replacement, payload);
    rmSync(member);
    symlinkSync(replacement, member);
    assert.throws(
      () =>
        sourceAuthorization.verifyTask9Source({
          authorizationPath: authorization,
          authorizationSha256Path: digest,
          sourceRoot,
        }),
      /refused/
    );
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});

test('exposes a descriptor-held verification callback for source execution', () => {
  assert.equal(typeof sourceAuthorization.withVerifiedTask9Source, 'function');
  assert.equal(
    typeof sourceAuthorization.runTask9SourceAuthorizationCli,
    'function'
  );
});

test('holds the authorization descriptor before opening its digest companion', async () => {
  const source = await readFile(
    new URL('./task9-source-authorization.mjs', import.meta.url),
    'utf8'
  );
  assert.match(
    source,
    /const authorization = openClosed\(authorizationPath\);\n {4}held\.push\(authorization\);\n {4}const authorizationDigest = openClosed\(authorizationSha256Path\);/
  );
});

test('keeps authorized source descriptors open through the execution callback', () => {
  const root = mkdtempSync(join(tmpdir(), 'task9-held-source-'));
  try {
    const relativePath = 'infra/cwv-runner/task9-source-authorization.mjs';
    const sourceRoot = join(root, 'authorized-source');
    const member = join(sourceRoot, relativePath);
    mkdirSync(join(sourceRoot, 'infra/cwv-runner'), { recursive: true });
    const payload = Buffer.from('authorized source');
    writeFileSync(member, payload, { mode: 0o644 });
    const policy = installPolicy(sourceRoot);
    const receipt = Buffer.from(
      canonical({
        policyFileSha256: policy.sha256,
        purpose: 'task9-exact-run',
        sourceFiles: [{ path: relativePath, sha256: hash(payload) }],
      })
    );
    const authorizationPath = join(root, 'source-authorization.json');
    const authorizationSha256Path = join(root, 'source-authorization.sha256');
    writeFileSync(authorizationPath, receipt);
    writeFileSync(authorizationSha256Path, `${hash(receipt)}\n`);
    let sourceDescriptor;
    sourceAuthorization.withVerifiedTask9Source(
      { authorizationPath, authorizationSha256Path, sourceRoot },
      (_receiptHash, readHeld, descriptors) => {
        sourceDescriptor = descriptors.get(relativePath);
        renameSync(member, `${member}.replaced`);
        writeFileSync(member, 'unreviewed replacement', { mode: 0o644 });
        assert.equal(fstatSync(sourceDescriptor).size, payload.length);
        assert.deepEqual(readHeld(relativePath), payload);
      }
    );
    assert.throws(() => fstatSync(sourceDescriptor), /bad file descriptor/i);
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});

test('refuses a transport-path substitution before the token-reading transport loads', () => {
  const root = mkdtempSync(join(tmpdir(), 'task9-verified-transport-'));
  try {
    const sourceRoot = join(root, 'authorized-source');
    const relativePath = 'infra/cwv-runner/owner-api-transport-runtime.mjs';
    const member = join(sourceRoot, relativePath);
    mkdirSync(join(sourceRoot, 'infra/cwv-runner'), { recursive: true });
    const trusted = Buffer.from(
      'globalThis.__task9TransportLoaded = true; export async function runTransportCli(args, options){ return "trusted:" + args[0] + ":" + options.transportPolicy.policy.pathPrefix; }\n'
    );
    writeFileSync(member, trusted, { mode: 0o644 });
    const policy = installPolicy(sourceRoot);
    const receipt = Buffer.from(
      canonical({
        policyFileSha256: policy.sha256,
        purpose: 'task9-exact-run',
        sourceFiles: [{ path: relativePath, sha256: hash(trusted) }],
      })
    );
    const authorizationPath = join(root, 'source-authorization.json');
    const authorizationSha256Path = join(root, 'source-authorization.sha256');
    writeFileSync(authorizationPath, receipt);
    writeFileSync(authorizationSha256Path, `${hash(receipt)}\n`);

    delete globalThis.__task9TransportLoaded;
    assert.throws(
      () =>
        sourceAuthorization.runVerifiedTask9Transport(
          { authorizationPath, authorizationSha256Path, sourceRoot },
          ['exact-operation'],
          () => {
            renameSync(member, `${member}.trusted`);
            writeFileSync(
              member,
              'globalThis.__task9TransportLoaded = "substituted"; export async function runTransportCli(){ return "substituted"; }\n',
              { mode: 0o644 }
            );
          }
        ),
      /refused/
    );
    assert.equal(globalThis.__task9TransportLoaded, undefined);
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});

test('owner dispatch gives the owner token only to a descriptor-sealed transport launcher', async () => {
  const dispatcher = await readFile(
    new URL('./owner-dispatch.sh', import.meta.url),
    'utf8'
  );
  assert.match(
    dispatcher,
    /--eval 'import \{createHash\} from "node:crypto";import \{fstatSync,lstatSync,readFileSync\} from "node:fs";.*same\(held,current\).*readFileSync\(3\).*data:text\/javascript;base64.*runTask9SourceAuthorizationCli/
  );
  assert.match(dispatcher, /3<"\$manifest"/);
  assert.doesNotMatch(dispatcher, /"\$node" "\$manifest" (?:verify|execute)/);
  assert.doesNotMatch(dispatcher, /"\$node" "\$transport" --operation/);
});

test('rejects a manifest replacement before the token pipe reaches its code', async () => {
  const dispatcher = await readFile(
    new URL('./owner-dispatch.sh', import.meta.url),
    'utf8'
  );
  const loader = dispatcher.match(/--eval '([^']+)'/)?.[1];
  assert.ok(loader);
  const root = mkdtempSync(join(tmpdir(), 'task9-sealed-launcher-'));
  let descriptor;
  try {
    const manifest = join(root, 'task9-source-authorization.mjs');
    const leak = join(root, 'token-leak');
    const trusted = Buffer.from(
      'export async function runTask9SourceAuthorizationCli() {}\n'
    );
    writeFileSync(manifest, trusted, { mode: 0o400 });
    descriptor = openSync(manifest, 'r');
    renameSync(manifest, `${manifest}.trusted`);
    writeFileSync(
      manifest,
      'import { readFileSync, writeFileSync } from "node:fs"; writeFileSync(process.env.LEAK_PATH, readFileSync(0));\n',
      { mode: 0o400 }
    );
    const result = spawnSync(
      process.execPath,
      [
        '--input-type=module',
        '--eval',
        loader,
        hash(trusted),
        '/authorization',
        '/authorization.sha256',
        '/source-root',
        'list-attestation-runs',
        '/state',
        '/state.sha256',
        manifest,
      ],
      {
        encoding: 'utf8',
        env: { ...process.env, LEAK_PATH: leak },
        input: 'owner-token\n',
        stdio: ['pipe', 'pipe', 'pipe', descriptor],
      }
    );
    assert.notEqual(result.status, 0);
    assert.equal(existsSync(leak), false);
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
    rmSync(root, { force: true, recursive: true });
  }
});

test('loads the complete verified transport module graph without path imports', async () => {
  const root = mkdtempSync(join(tmpdir(), 'task9-transport-graph-'));
  try {
    const workspaceRoot = new URL('../../', import.meta.url).pathname;
    const sourceRoot = join(root, 'authorized-source');
    const policy = installPolicy(sourceRoot);
    const sourceFiles = await Promise.all(
      TRANSPORT_SOURCE_FILES.map(async (path) => {
        const bytes = await readFile(join(workspaceRoot, path));
        const target = join(sourceRoot, path);
        mkdirSync(join(target, '..'), { recursive: true });
        writeFileSync(target, bytes, { mode: 0o400 });
        return { path, sha256: hash(bytes) };
      })
    );
    const receipt = Buffer.from(
      JSON.stringify({
        policyFileSha256: policy.sha256,
        purpose: 'task9-exact-run',
        sourceFiles,
      })
    );
    const authorizationPath = join(root, 'source-authorization.json');
    const authorizationSha256Path = join(root, 'source-authorization.sha256');
    writeFileSync(authorizationPath, receipt);
    writeFileSync(authorizationSha256Path, `${hash(receipt)}\n`);
    await assert.rejects(
      sourceAuthorization.runVerifiedTask9Transport(
        { authorizationPath, authorizationSha256Path, sourceRoot },
        []
      ),
      /invocation/
    );
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});
