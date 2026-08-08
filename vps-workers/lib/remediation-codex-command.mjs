import { existsSync } from 'node:fs';
import { basename, join } from 'node:path';

function bindMount(source, destination, { readonly = false } = {}) {
  return `type=bind,src=${source},dst=${destination}${readonly ? ',readonly' : ''}`;
}

function containerNameFor(worktreeDir) {
  const suffix = basename(worktreeDir)
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, '-')
    .replace(/^[^a-z0-9]+/, '')
    .slice(0, 42);
  return `baci-remediation-${suffix || process.pid}`;
}

function buildDockerRuntimeArgs({ containerName, repoDir, worktreeDir }) {
  return [
    'run',
    '--rm',
    '--name',
    containerName,
    '--cap-drop',
    'ALL',
    '--security-opt',
    'no-new-privileges',
    '--pids-limit',
    '512',
    '--cpus',
    '1',
    '--memory',
    '2g',
    '--memory-swap',
    '2g',
    '--tmpfs',
    '/tmp:rw,nosuid,nodev,size=1g',
    '--user',
    `${process.getuid()}:${process.getgid()}`,
    '--env',
    'HOME=/tmp',
    '--env',
    'GIT_OPTIONAL_LOCKS=0',
    '--mount',
    bindMount(worktreeDir, worktreeDir),
    '--mount',
    bindMount(join(repoDir, '.git'), join(repoDir, '.git'), {
      readonly: true,
    }),
  ];
}

function addDependencyMounts({ args, dependencyRoot, worktreeDir }) {
  for (const relativePath of [
    'node_modules',
    'apps/web/node_modules',
    'apps/mobile-admin/node_modules',
    'apps/mobile-storefront/node_modules',
  ]) {
    const source = join(dependencyRoot, relativePath);
    if (existsSync(source)) {
      args.push(
        '--mount',
        bindMount(source, join(worktreeDir, relativePath), { readonly: true })
      );
    }
  }
}

export function buildRemediationCodexCommand({
  codexBin,
  env,
  prompt,
  repoDir,
  worktreeDir,
}) {
  const codexArgs = [
    '--search',
    'exec',
    '--ephemeral',
    '--skip-git-repo-check',
    '--sandbox',
    'workspace-write',
    '-C',
    worktreeDir,
    prompt,
  ];
  const image = env.BACI_CODEX_DOCKER_IMAGE;
  if (!image) {
    return { args: codexArgs, command: codexBin };
  }

  const codexHome = env.CODEX_HOME || join(env.HOME, '.codex');
  const containerCodexBin = env.BACI_CODEX_CONTAINER_BIN;
  if (!containerCodexBin) {
    throw new Error(
      'BACI_CODEX_CONTAINER_BIN is required for Docker execution'
    );
  }
  const dockerBin = env.DOCKER_BIN || 'docker';
  const containerName = containerNameFor(worktreeDir);
  const dockerArgs = buildDockerRuntimeArgs({
    containerName,
    repoDir,
    worktreeDir,
  });
  dockerArgs.push(
    '--env',
    'CODEX_HOME=/tmp/codex-home',
    '--mount',
    bindMount(join(codexHome, 'auth.json'), '/codex-auth/auth.json', {
      readonly: true,
    }),
    '--mount',
    bindMount(containerCodexBin, '/opt/codex/bin/codex', { readonly: true })
  );

  const dependencyRoot = env.BACI_REMEDIATION_DEPENDENCY_ROOT || repoDir;
  addDependencyMounts({
    args: dockerArgs,
    dependencyRoot,
    worktreeDir,
  });

  dockerArgs.push(
    '--workdir',
    worktreeDir,
    image,
    'sh',
    '-lc',
    'mkdir -p "$CODEX_HOME"; cp /codex-auth/auth.json "$CODEX_HOME/auth.json"; chmod 600 "$CODEX_HOME/auth.json"; exec /opt/codex/bin/codex "$@"',
    'codex',
    '--search',
    '--enable',
    'use_legacy_landlock',
    'exec',
    '--ephemeral',
    '--skip-git-repo-check',
    '--dangerously-bypass-approvals-and-sandbox',
    '--ignore-user-config',
    '-C',
    worktreeDir,
    prompt
  );

  return {
    args: dockerArgs,
    cleanup: { args: ['rm', '-f', containerName], command: dockerBin },
    command: dockerBin,
  };
}

export function buildRemediationVerificationCommand({
  env,
  repoDir,
  verifyCommand,
  worktreeDir,
}) {
  const image = env.BACI_CODEX_DOCKER_IMAGE;
  if (!image) {
    return { args: ['-lc', verifyCommand], command: 'bash' };
  }

  const dockerBin = env.DOCKER_BIN || 'docker';
  const containerName = `${containerNameFor(worktreeDir)}-verify`;
  const dockerArgs = buildDockerRuntimeArgs({
    containerName,
    repoDir,
    worktreeDir,
  });
  addDependencyMounts({
    args: dockerArgs,
    dependencyRoot: env.BACI_REMEDIATION_DEPENDENCY_ROOT || repoDir,
    worktreeDir,
  });
  dockerArgs.push('--workdir', worktreeDir, image, 'sh', '-lc', verifyCommand);

  return {
    args: dockerArgs,
    cleanup: { args: ['rm', '-f', containerName], command: dockerBin },
    command: dockerBin,
  };
}
