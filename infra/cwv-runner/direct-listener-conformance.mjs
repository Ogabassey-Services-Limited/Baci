import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { canonicalJson, canonicalSha256 } from './canonical-json.mjs';
import { parseRunnerPolicy, requireRunnerPolicy } from './policy.schema.mjs';

const digest = (value) =>
  typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
const sha256 = (path) =>
  createHash('sha256').update(readFileSync(path)).digest('hex');
const fail = (message) => {
  throw new TypeError(`conformance ${message}`);
};
const exactKeys = (value, keys) =>
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  JSON.stringify(Object.keys(value).sort()) ===
    JSON.stringify([...keys].sort());
// biome-ignore format: immutable sandbox paths are audited as a closed tuple.
const writablePaths = Object.freeze(['/opt/runner/_diag', '/registration-staging', '/runner-work', '/tmp/baci-cwv']);
// biome-ignore format: sealed configure environment is an audited closed tuple.
const configureEnvironment = Object.freeze('ACTIONS_RUNNER_INPUT_TOKEN HOME LANG LC_ALL PATH TMPDIR'.split(' '));
const runEnvironment = Object.freeze(
  'DISABLE_RUNNER_UPDATE HOME LANG LC_ALL PATH TMPDIR'.split(' ')
);
// biome-ignore format: expected terminal statuses are an audited closed tuple.
const expectedExits = Object.freeze({ configure: 0, 'configure-exec-failure': 23, run: 0, 'run-rejects-disableupdate': 64, 'run-sigint': 130, 'run-sigterm': 143 });
// biome-ignore format: the accepted direct-listener argv is a closed audited tuple.
export function expectedConfigureArgv(policy, root = '/registration-staging/actions-runner') { return [`${root}/bin/Runner.Listener`, 'configure', '--unattended', '--url', `https://github.com/${policy.repository.name}`, '--name', policy.runner.name, '--labels', 'baci-cwv-measurement', '--work', '/runner-work', '--disableupdate']; }
// biome-ignore format: the accepted direct-listener argv is a closed audited tuple.
export const expectedRunArgv = Object.freeze(['/opt/runner/bin/Runner.Listener', 'run', '--once']);
function assertExecutable(binding, version) {
  if (
    !exactKeys(binding, ['path', 'sha256', 'version']) ||
    !digest(binding.sha256) ||
    binding.version !== version
  )
    fail('executable binding refused');
  const info = lstatSync(binding.path);
  if (!info.isFile() || info.isSymbolicLink() || (info.mode & 0o111) === 0)
    fail('executable identity refused');
  if (sha256(binding.path) !== binding.sha256) fail('executable hash refused');
}
function assertSources(sources) {
  if (!Array.isArray(sources) || sources.length === 0) fail('sources refused');
  const names = new Set();
  for (const source of sources) {
    if (!exactKeys(source, ['path', 'sha256']) || !digest(source.sha256))
      fail('source binding refused');
    if (names.has(source.path) || sha256(source.path) !== source.sha256)
      fail('source hash refused');
    names.add(source.path);
  }
}
function assertCase(caseDefinition, manifest) {
  const keys = ['argv', 'environment', 'executable', 'name', 'writablePaths'];
  if (caseDefinition.expectedExit !== undefined) keys.push('expectedExit');
  if (!exactKeys(caseDefinition, keys) || !Array.isArray(caseDefinition.argv))
    fail('case schema refused');
  if (
    caseDefinition.expectedExit !== undefined &&
    (!Number.isInteger(caseDefinition.expectedExit) ||
      caseDefinition.expectedExit < 1 ||
      caseDefinition.expectedExit > 255)
  )
    fail('expected exit refused');
  if (
    !writablePaths.every((path) => caseDefinition.writablePaths.includes(path))
  )
    fail('writable paths refused');
  if (
    caseDefinition.writablePaths.length !== writablePaths.length ||
    new Set(caseDefinition.writablePaths).size !== writablePaths.length
  )
    fail('writable paths refused');
  const isConfigure = caseDefinition.name.startsWith('configure');
  const expected = isConfigure ? configureEnvironment : runEnvironment;
  const environment = Object.keys(caseDefinition.environment).sort();
  const permitted = caseDefinition.name.startsWith('run-sig')
    ? [...expected, 'BACI_CWV_FIXTURE_SIGNAL'].sort()
    : expected;
  if (
    JSON.stringify(environment) !== JSON.stringify(permitted) ||
    Object.values(caseDefinition.environment).some(
      (value) => typeof value !== 'string'
    ) ||
    caseDefinition.environment.TMPDIR !== '/tmp/baci-cwv'
  )
    fail('environment refused');
  const executable = isConfigure ? manifest.node.path : manifest.listener.path;
  if (caseDefinition.executable !== executable)
    fail(isConfigure ? 'configure node refused' : 'run listener refused');
}
const exitStatus = ({ code, signal }) => {
  if (Number.isInteger(code)) return code;
  return signal === 'SIGTERM' ? 143 : signal === 'SIGINT' ? 130 : 1;
};
const execute = (definition, cwd, policy, dependencies = {}) =>
  new Promise((resolve, reject) => {
    const spawnChild = dependencies.spawn ?? spawn;
    const schedule = dependencies.setTimeout ?? setTimeout;
    const cancel = dependencies.clearTimeout ?? clearTimeout;
    const controller = new AbortController();
    let child;
    let timer;
    let timedOut = false;
    const cleanup = () => {
      if (timer !== undefined) cancel(timer);
      child?.removeListener('error', onError);
      child?.removeListener('exit', onExit);
    };
    const settle = (complete, value) => {
      cleanup();
      complete(value);
    };
    const onError = (error) => {
      if (!timedOut) settle(reject, error);
    };
    const onExit = (code, signal) =>
      settle(
        timedOut ? reject : resolve,
        timedOut
          ? new TypeError(`conformance child timeout: ${definition.name}`)
          : { pid: child.pid, status: exitStatus({ code, signal }) }
      );
    try {
      child = spawnChild(definition.executable, definition.argv, {
        cwd,
        env: definition.environment,
        shell: false,
        signal: controller.signal,
        stdio: 'ignore',
      });
      child.once('error', onError);
      child.once('exit', onExit);
      timer = schedule(() => {
        timedOut = true;
        controller.abort();
        child.kill('SIGKILL');
      }, policy.repositoryAuthority.hookTimeoutSeconds * 1000);
    } catch (error) {
      settle(reject, error);
    }
  });
function parseReport(path, definition, result, token, cwd) {
  if (!existsSync(path)) fail('fixture report missing');
  const raw = readFileSync(path, 'utf8');
  if (token && raw.includes(token)) fail('token disclosure refused');
  let report;
  try {
    report = JSON.parse(raw);
  } catch {
    fail('fixture report JSON refused');
  }
  if (definition.name === 'configure-exec-failure') {
    if (
      !exactKeys(report, [
        'defaultDropRestored',
        'noSurvivingProcess',
        'stagingRemoved',
        'tokenDeleted',
      ]) ||
      Object.values(report).some((value) => value !== true)
    )
      fail('exec failure cleanup refused');
    return report;
  }
  if (
    !exactKeys(report, [
      'argv',
      'counters',
      'cwd',
      'environment',
      'pid',
      'writablePaths',
    ])
  )
    fail('fixture report schema refused');
  if (report.cwd !== cwd) fail('fixture cwd refused');
  if (report.pid !== result.pid) fail('fixture pid refused');
  if (
    JSON.stringify(report.environment) !==
    JSON.stringify(Object.keys(definition.environment).sort())
  )
    fail('fixture environment refused');
  if (
    JSON.stringify([...report.writablePaths].sort()) !==
    JSON.stringify(writablePaths)
  )
    fail('fixture writable paths refused');
  if (
    !exactKeys(report.counters, ['preReleasePackets', 'releasedPackets']) ||
    report.counters.preReleasePackets !== 0 ||
    report.counters.releasedPackets < 1
  )
    fail('fixture counters refused');
  return report;
}
export async function runDirectListenerConformance(manifest, value, deps) {
  const policy = requireRunnerPolicy(value);
  if (
    !exactKeys(manifest, [
      'cases',
      'cwd',
      'launcherSources',
      'listener',
      'node',
      'report',
    ]) ||
    typeof manifest.cwd !== 'string' ||
    typeof manifest.report !== 'string' ||
    !Array.isArray(manifest.cases)
  )
    fail('manifest refused');
  assertExecutable(manifest.node, policy.supplyChain.node.version);
  assertExecutable(manifest.listener, policy.supplyChain.runner.version);
  assertSources(manifest.launcherSources);
  // biome-ignore format: matrix cases are an audited closed tuple.
  const required = ['configure', 'configure-exec-failure', 'run', 'run-rejects-disableupdate', 'run-sigint', 'run-sigterm'];
  if (
    manifest.cases.length !== required.length ||
    JSON.stringify(manifest.cases.map(({ name }) => name).sort()) !==
      JSON.stringify(required.sort())
  )
    fail('matrix refused');
  const evidence = {};
  for (const definition of manifest.cases) {
    assertCase(definition, manifest);
    rmSync(manifest.report, { force: true });
    const result = await execute(definition, manifest.cwd, policy, deps);
    if (
      definition.expectedExit !== undefined &&
      definition.expectedExit !== expectedExits[definition.name]
    )
      fail('matrix exit refused');
    if (result.status !== expectedExits[definition.name])
      fail(`exit refused: ${definition.name}:${result.status}`);
    const report = parseReport(
      manifest.report,
      definition,
      result,
      definition.environment.ACTIONS_RUNNER_INPUT_TOKEN ?? '',
      manifest.cwd
    );
    evidence[definition.name] = report;
  }
  const configure = evidence.configure;
  const run = evidence.run;
  if (
    JSON.stringify(configure.argv) !==
    JSON.stringify([
      manifest.listener.path,
      ...expectedConfigureArgv(policy).slice(1),
    ])
  )
    fail('configure argv refused');
  if (
    JSON.stringify(run.argv) !==
    JSON.stringify([manifest.listener.path, ...expectedRunArgv.slice(1)])
  )
    fail('run argv refused');
  return Object.freeze({
    configure: Object.freeze({
      argv: configure.argv,
      pidTransition: true,
      preReleasePackets: configure.counters.preReleasePackets,
    }),
    digest: canonicalSha256({ evidence, manifest }),
    run: Object.freeze({
      argv: expectedRunArgv,
      releasedPackets: run.counters.releasedPackets,
    }),
  });
}
async function main() {
  const [manifestFlag, manifestPath, policyFlag, policyPath, ...extra] =
    process.argv.slice(2);
  if (
    manifestFlag !== '--manifest' ||
    policyFlag !== '--policy' ||
    extra.length !== 0
  )
    fail('CLI refused');
  const receipt = await runDirectListenerConformance(
    JSON.parse(readFileSync(manifestPath, 'utf8')),
    parseRunnerPolicy(JSON.parse(readFileSync(policyPath, 'utf8')))
  );
  process.stdout.write(`${canonicalJson(receipt)}\n`);
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    await main();
  } catch {
    process.stderr.write('direct listener conformance refused\n');
    process.exitCode = 1;
  }
}
