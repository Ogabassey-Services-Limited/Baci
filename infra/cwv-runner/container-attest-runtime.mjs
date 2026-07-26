import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readlinkSync, statSync } from 'node:fs';
import { posix, resolve, sep } from 'node:path';
import { canonicalJson } from './canonical-json.mjs';

const IMAGE_ID = /^sha256:[a-f0-9]{64}$/;
const COMMAND_ENV = Object.freeze({});
const COMMAND_MAX_BUFFER = 64 * 1024;
const COMMAND_TIMEOUT_MS = 15_000;

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function fail(message) {
  throw new TypeError(`runtime attestation refused: ${message}`);
}

export function collectRuntimeIdentity(rootArgument, launchedImageId) {
  const runtimeRoot = resolve(rootArgument ?? '');
  if (
    !rootArgument ||
    runtimeRoot !== rootArgument ||
    !IMAGE_ID.test(launchedImageId ?? '')
  )
    fail('invocation drift');
  const runtimePath = (path) => {
    if (!path.startsWith('/')) fail('path drift');
    const result = resolve(runtimeRoot, `.${path}`);
    if (
      runtimeRoot !== '/' &&
      result !== runtimeRoot &&
      !result.startsWith(`${runtimeRoot}${sep}`)
    )
      fail('path escape');
    return result;
  };
  const expectedOwner =
    runtimeRoot === '/' ? { gid: 0, uid: 0 } : statSync(runtimeRoot);
  const rootFile = (path, recordPath = path) => {
    const physical = runtimePath(path);
    let link;
    let details;
    try {
      link = lstatSync(physical);
      details = statSync(physical);
    } catch {
      fail('projection missing');
    }
    if (
      !link.isFile() ||
      link.isSymbolicLink() ||
      details.uid !== expectedOwner.uid ||
      details.gid !== expectedOwner.gid
    )
      fail('projection mode drift');
    return {
      executablePath: physical,
      record: { path: recordPath, sha256: sha256(readFileSync(physical)) },
    };
  };
  rootFile('/opt/baci-cwv/canonical-json.mjs');
  const text = (file, args) => {
    const result = spawnSync(file.executablePath, args, {
      encoding: 'utf8',
      env: COMMAND_ENV,
      killSignal: 'SIGKILL',
      maxBuffer: COMMAND_MAX_BUFFER,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: COMMAND_TIMEOUT_MS,
    });
    if (result.error?.code === 'ETIMEDOUT') fail('runtime command timeout');
    if (result.error?.code === 'ENOBUFS') fail('runtime command output drift');
    if (result.signal !== null) fail('runtime command execution drift');
    if (result.error) fail('runtime command execution drift');
    if (result.status !== 0) fail('runtime command exit drift');
    if (result.stderr) fail('runtime command stderr drift');
    if (typeof result.stdout !== 'string') fail('runtime command output drift');
    return result.stdout.trim();
  };
  const version = (file, args, pattern, name) => {
    const value = text(file, args).match(pattern)?.[1];
    if (!value) fail(`${name} version drift`);
    return value;
  };

  const manifestFile = rootFile('/opt/runner/runtime-manifest.json');
  const contractFile = rootFile('/opt/runner/identity-contract.json');
  const contract = JSON.parse(
    readFileSync(contractFile.executablePath, 'utf8')
  );
  const runtimeContract = contract?.builderSources?.runtime;
  if (
    !runtimeContract ||
    canonicalJson(runtimeContract.keys) !==
      canonicalJson([
        'chrome',
        'imageId',
        'node',
        'pnpm',
        'runtimeRunner',
        'runtimeRunnerBinaryDigest',
        'schemaVersion',
      ])
  )
    fail('identity contract drift');
  const manifestBytes = readFileSync(manifestFile.executablePath, 'utf8');
  const manifest = JSON.parse(manifestBytes);
  if (
    canonicalJson(manifest) !== manifestBytes.trim() ||
    canonicalJson(Object.keys(manifest).sort()) !==
      canonicalJson([
        'chromeTargetPath',
        'pnpmPackage',
        'runtime',
        'schemaVersion',
      ]) ||
    manifest.schemaVersion !== 1
  )
    fail('runtime manifest drift');
  if (manifest.chromeTargetPath !== runtimeContract.chrome.targetPath)
    fail('Chrome symlink target drift');

  const chromePath = '/usr/bin/google-chrome-stable';
  const chromeLink = lstatSync(runtimePath(chromePath));
  if (
    !chromeLink.isSymbolicLink() ||
    chromeLink.uid !== expectedOwner.uid ||
    chromeLink.gid !== expectedOwner.gid
  )
    fail('Chrome symlink drift');
  const chromeLinkTarget = readlinkSync(runtimePath(chromePath));
  const chromeTarget = posix.resolve(
    posix.dirname(chromePath),
    chromeLinkTarget
  );
  if (
    chromeLinkTarget !== manifest.chromeTargetPath ||
    chromeTarget !== manifest.chromeTargetPath
  )
    fail('Chrome symlink target drift');
  const chrome = rootFile(chromeTarget, chromePath);
  const node = rootFile('/opt/node/bin/node');
  const pnpmPackage = rootFile('/opt/pnpm/package.json');
  const dpkgQuery = rootFile('/usr/bin/dpkg-query');
  const runnerFiles = runtimeContract.runnerFiles.map((path) =>
    rootFile(`/opt/runner/${path}`, path)
  );
  const listener = runnerFiles.find(
    (file) => file.record.path === 'bin/Runner.Listener'
  );
  if (!listener) fail('runner listener projection drift');
  const chromeVersion = version(
    chrome,
    ['--version'],
    /(?:Google Chrome|Google Chrome Stable) ([0-9.]+)/,
    'Chrome'
  );
  const nodeVersion = version(node, ['--version'], /^v?([0-9.]+)$/, 'Node');
  const runnerVersion = version(
    listener,
    ['--version'],
    /([0-9]+\.[0-9]+\.[0-9]+)/,
    'runner'
  );
  const packageJson = JSON.parse(
    readFileSync(pnpmPackage.executablePath, 'utf8')
  );
  const packageProjection = {
    bin: packageJson?.bin?.pnpm ?? packageJson?.bin,
    name: packageJson?.name,
    version: packageJson?.version,
  };
  if (packageProjection.bin !== 'bin/pnpm.cjs') fail('pnpm entrypoint drift');
  const pnpmProgram = rootFile(`/opt/pnpm/${packageProjection.bin}`);
  const pnpmVersion = version(
    node,
    [pnpmProgram.executablePath, '--version'],
    /^([0-9.]+)$/,
    'pnpm'
  );
  const debianRows = text(dpkgQuery, [
    `--root=${runtimeRoot}`,
    // biome-ignore lint/suspicious/noTemplateCurlyInString: dpkg-query expands these placeholders.
    '--showformat=${Package}\t${Version}\t${Architecture}\n',
    '--show',
    runtimeContract.chrome.debianPackage.name,
  ]).split('\t');
  if (debianRows.length !== 3) fail('Chrome package drift');
  const debianPackage = {
    architecture: debianRows[2],
    name: debianRows[0],
    version: debianRows[1],
  };
  if (
    canonicalJson(packageProjection) !== canonicalJson(manifest.pnpmPackage) ||
    canonicalJson(packageProjection) !==
      canonicalJson(runtimeContract.pnpm.packageProjection) ||
    canonicalJson(debianPackage) !==
      canonicalJson(runtimeContract.chrome.debianPackage)
  )
    fail('runtime package drift');
  if (
    chromeVersion !== runtimeContract.chrome.version ||
    nodeVersion !== runtimeContract.node.version ||
    pnpmVersion !== runtimeContract.pnpm.version ||
    runnerVersion !== runtimeContract.runnerVersion
  )
    fail('runtime version drift');

  const runtimeRunner = {
    files: runnerFiles.map((file) => file.record),
    version: runnerVersion,
  };
  const payload = {
    chrome: {
      binarySha256: chrome.record.sha256,
      debianPackage,
      debianSha256: runtimeContract.chrome.debianSha256,
      version: chromeVersion,
    },
    imageId: launchedImageId,
    node: { binarySha256: node.record.sha256, version: nodeVersion },
    pnpm: {
      binarySha256: pnpmProgram.record.sha256,
      packageJsonSha256: pnpmPackage.record.sha256,
      packageProjection,
      version: pnpmVersion,
    },
    runtimeRunner,
    runtimeRunnerBinaryDigest: sha256(canonicalJson(runtimeRunner)),
    schemaVersion: 1,
  };
  if (canonicalJson(manifest.runtime) !== canonicalJson(payload))
    fail('runtime runner binary digest mismatch');
  const canonicalPayload = canonicalJson(payload);
  return {
    canonical: canonicalPayload,
    owner: { gid: 10001, mode: '0640', uid: 0 },
    schemaVersion: 1,
    sha256Receipt: `${sha256(canonicalPayload)}\n`,
    source: 'runtime',
  };
}

async function main(argv) {
  if (argv.length !== 2) fail('invalid arguments');
  process.stdout.write(
    `${canonicalJson(await collectRuntimeIdentity(argv[0], argv[1]))}\n`
  );
}

if (import.meta.filename === process.argv[1]) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 65;
  });
}
