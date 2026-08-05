import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import {
  buildCodexRemediationPrompt,
  evaluateMergePolicy,
} from './remediation-policy.mjs';
import { buildRemediationPrBody } from './remediation-pr-body.mjs';
import { writeRemediationResultArtifact } from './remediation-result-artifact.mjs';

function defaultRunner(command, args, options) {
  return spawnSync(command, args, {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
    ...options,
  });
}

function runChecked(command, args, options) {
  const result = options.runner(command, args, {
    cwd: options.cwd,
    env: options.env,
    shell: options.shell || false,
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(' ')} failed: ${(result.stderr || result.stdout || '').slice(0, 2000)}`
    );
  }
  return result.stdout || '';
}

function sanitizeRunId(value) {
  const runId = String(value || randomUUID())
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);
  return runId || randomUUID().toLowerCase().slice(0, 24);
}

function branchNameFor(candidate, runId) {
  const source = sanitizeRunId(candidate.sample?.source || 'vercel');
  return `codex/${source}-remediation-${candidate.fingerprint}-${runId}`;
}

const CHILD_ENV_ALLOWLIST = new Set([
  'CI',
  'CODEX_HOME',
  'HOME',
  'LANG',
  'LC_ALL',
  'LOGNAME',
  'PATH',
  'SHELL',
  'TEMP',
  'TMP',
  'TMPDIR',
  'USER',
  'XDG_CONFIG_HOME',
]);

const GIT_AUTH_ENV_ALLOWLIST = new Set([
  'GH_TOKEN',
  'GITHUB_TOKEN',
  'GIT_ASKPASS',
  'GIT_SSH_COMMAND',
  'SSH_AUTH_SOCK',
]);

const GIT_IDENTITY_ENV_ALLOWLIST = new Set([
  'GIT_AUTHOR_EMAIL',
  'GIT_AUTHOR_NAME',
  'GIT_COMMITTER_EMAIL',
  'GIT_COMMITTER_NAME',
]);

function buildChildEnvironment(commandEnv) {
  return Object.fromEntries(
    Object.entries(commandEnv).filter(
      ([key, value]) =>
        CHILD_ENV_ALLOWLIST.has(key) && typeof value === 'string'
    )
  );
}

function buildGitIdentityEnvironment(commandEnv, childEnv) {
  return {
    ...childEnv,
    ...Object.fromEntries(
      Object.entries(commandEnv).filter(
        ([key, value]) =>
          GIT_IDENTITY_ENV_ALLOWLIST.has(key) && typeof value === 'string'
      )
    ),
  };
}

function buildGitEnvironment(commandEnv, gitIdentityEnv) {
  return {
    ...gitIdentityEnv,
    ...Object.fromEntries(
      Object.entries(commandEnv).filter(
        ([key, value]) =>
          GIT_AUTH_ENV_ALLOWLIST.has(key) && typeof value === 'string'
      )
    ),
  };
}

function parseStatusFiles(status) {
  return String(status || '')
    .split(/\r?\n/)
    .map((line) => line.slice(3).trim())
    .flatMap((line) => line.split(' -> '))
    .filter(Boolean);
}

function cleanupWorktree({ childEnv, repoDir, runner, worktreeDir }) {
  if (!worktreeDir) {
    return;
  }
  runner('git', ['worktree', 'remove', '--force', worktreeDir], {
    cwd: repoDir,
    env: childEnv,
    shell: false,
  });
}

export function runRemediationAutofix({
  candidate,
  env = process.env,
  prompt = buildCodexRemediationPrompt({ candidate }),
  runner = defaultRunner,
}) {
  const repoDir = env.BACI_REPO_DIR;
  if (!repoDir) {
    throw new Error('BACI_REPO_DIR is required for autofix mode');
  }

  const runId = sanitizeRunId(env.BACI_REMEDIATION_RUN_ID);
  const branch = branchNameFor(candidate, runId);
  const commandEnv = { ...process.env, ...env };
  const childEnv = buildChildEnvironment(commandEnv);
  const gitIdentityEnv = buildGitIdentityEnvironment(commandEnv, childEnv);
  const gitEnv = buildGitEnvironment(commandEnv, gitIdentityEnv);
  const worktreeRoot =
    env.BACI_REMEDIATION_WORKTREE_ROOT ||
    join(dirname(repoDir), 'baci-remediation-worktrees');
  const worktreeDir = join(worktreeRoot, `${candidate.fingerprint}-${runId}`);
  const rootCommandOptions = { cwd: repoDir, env: childEnv, runner };
  const rootRemoteCommandOptions = { cwd: repoDir, env: gitEnv, runner };
  const worktreeCommandOptions = { cwd: worktreeDir, env: childEnv, runner };
  const worktreeGitCommandOptions = {
    cwd: worktreeDir,
    env: gitIdentityEnv,
    runner,
  };
  const worktreeRemoteCommandOptions = {
    cwd: worktreeDir,
    env: gitEnv,
    runner,
  };
  const codexBin = env.CODEX_BIN || 'codex';
  const ghBin = env.GH_BIN || 'gh';
  let worktreeCreated = false;
  try {
    runChecked('git', ['fetch', 'origin', 'main'], rootRemoteCommandOptions);
    runChecked(
      'git',
      ['worktree', 'add', worktreeDir, '-b', branch, 'origin/main'],
      rootCommandOptions
    );
    worktreeCreated = true;
    const codexOutput = runChecked(
      codexBin,
      [
        '--search',
        'exec',
        '--ephemeral',
        '--skip-git-repo-check',
        '--sandbox',
        'workspace-write',
        '-C',
        worktreeDir,
        prompt,
      ],
      worktreeCommandOptions
    );
    const resultPath = writeRemediationResultArtifact({
      candidate,
      output: codexOutput,
      outputDir: env.BACI_REMEDIATION_OUTPUT_DIR,
    });
    const status = runChecked(
      'git',
      ['status', '--porcelain'],
      worktreeGitCommandOptions
    );
    if (!status.trim()) {
      return { branch, resultPath, type: 'no_changes', worktreeDir };
    }

    const changedFiles = parseStatusFiles(status);
    const policy = evaluateMergePolicy({
      changedFiles,
      checksPassed: true,
      hasHighSeverityReview: false,
      hasUnresolvedThreads: false,
    });
    if (!policy.allowed) {
      return {
        branch,
        changedFiles,
        reasons: policy.reasons,
        resultPath,
        type: 'policy_blocked',
        worktreeDir,
      };
    }

    const verifyCommand = env.BACI_REMEDIATION_VERIFY_COMMAND;
    if (!verifyCommand) {
      return {
        branch,
        changedFiles,
        reasons: [
          'BACI_REMEDIATION_VERIFY_COMMAND is required for autofix mode',
        ],
        resultPath,
        type: 'policy_blocked',
        worktreeDir,
      };
    }
    runChecked('bash', ['-lc', verifyCommand], worktreeCommandOptions);

    runChecked('git', ['add', '-A'], worktreeGitCommandOptions);
    runChecked(
      'git',
      [
        'commit',
        '-m',
        `Fix ${candidate.sample?.source || 'production'} error ${candidate.fingerprint}`,
      ],
      worktreeGitCommandOptions
    );
    runChecked(
      'git',
      ['-c', 'core.hooksPath=/dev/null', 'push', '-u', 'origin', branch],
      worktreeRemoteCommandOptions
    );
    const prUrl = runChecked(
      ghBin,
      [
        'pr',
        'create',
        '--base',
        'main',
        '--head',
        branch,
        '--title',
        `Fix ${candidate.sample?.source || 'production'} error ${candidate.fingerprint}`,
        '--body',
        buildRemediationPrBody(candidate),
        '--draft',
      ],
      {
        ...worktreeCommandOptions,
        env: {
          ...gitEnv,
        },
      }
    ).trim();

    return {
      branch,
      changedFiles,
      prUrl,
      resultPath,
      type: 'pr_opened',
      worktreeDir,
    };
  } finally {
    if (worktreeCreated) {
      cleanupWorktree({ childEnv, repoDir, runner, worktreeDir });
    }
  }
}
