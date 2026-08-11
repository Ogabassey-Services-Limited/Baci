import { existsSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

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

function currentContainerIdentity() {
  return {
    gid: typeof process.getgid === 'function' ? process.getgid() : 1000,
    uid: typeof process.getuid === 'function' ? process.getuid() : 1000,
  };
}

function buildDockerRuntimeArgs({
  containerName,
  readOnly = false,
  repoDir,
  worktreeDir,
}) {
  const { gid, uid } = currentContainerIdentity();
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
    '--tmpfs',
    `/codex-home:rw,nosuid,nodev,size=64m,uid=${uid},gid=${gid},mode=700`,
    '--user',
    `${uid}:${gid}`,
    '--env',
    'HOME=/tmp',
    '--env',
    'GIT_OPTIONAL_LOCKS=0',
    '--mount',
    bindMount(worktreeDir, worktreeDir, { readonly: readOnly }),
    '--mount',
    bindMount(join(repoDir, '.git'), join(repoDir, '.git'), {
      readonly: true,
    }),
  ];
}

function addDependencyMounts({
  args,
  dependencyRoot,
  worktreeDir,
  readonly = true,
}) {
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
        bindMount(source, join(worktreeDir, relativePath), { readonly })
      );
    }
  }
}

export function buildRemediationCodexCommand({
  codexBin,
  env,
  prompt,
  readOnly = false,
  repoDir,
  worktreeDir,
}) {
  const codexArgs = [
    ...(readOnly ? [] : ['--search']),
    'exec',
    '--json',
    '--ephemeral',
    '--skip-git-repo-check',
    '--sandbox',
    readOnly ? 'read-only' : 'workspace-write',
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
    readOnly,
    repoDir,
    worktreeDir,
  });
  if (readOnly) {
    dockerArgs.push('--read-only');
  }
  dockerArgs.push(
    '--env',
    'CODEX_HOME=/codex-home',
    '--mount',
    bindMount(join(codexHome, 'auth.json'), '/codex-auth/auth.json', {
      readonly: true,
    }),
    '--mount',
    bindMount(containerCodexBin, '/opt/codex/bin/codex', { readonly: true })
  );
  const codexResources = join(
    dirname(containerCodexBin),
    '..',
    'codex-resources'
  );
  if (existsSync(codexResources)) {
    dockerArgs.push(
      '--mount',
      bindMount(codexResources, '/opt/codex/codex-resources', {
        readonly: true,
      })
    );
  }

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
    'umask 077; mkdir -p "$CODEX_HOME"; chmod 700 "$CODEX_HOME"; cp /codex-auth/auth.json "$CODEX_HOME/auth.json"; chmod 600 "$CODEX_HOME/auth.json"; exec /opt/codex/bin/codex "$@"',
    'codex',
    ...(readOnly ? [] : ['--search']),
    ...(readOnly ? [] : ['--enable', 'use_legacy_landlock']),
    'exec',
    '--json',
    '--ephemeral',
    '--skip-git-repo-check',
    ...(readOnly
      ? ['--sandbox', 'workspace-write']
      : ['--dangerously-bypass-approvals-and-sandbox']),
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
    readOnly: false,
    repoDir,
    worktreeDir,
  });
  addDependencyMounts({
    args: dockerArgs,
    dependencyRoot: env.BACI_REMEDIATION_DEPENDENCY_ROOT || repoDir,
    worktreeDir,
    readonly: false,
  });
  dockerArgs.push('--workdir', worktreeDir, image, 'sh', '-lc', verifyCommand);

  return {
    args: dockerArgs,
    cleanup: { args: ['rm', '-f', containerName], command: dockerBin },
    command: dockerBin,
  };
}
