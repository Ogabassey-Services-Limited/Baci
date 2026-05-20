import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import {
  buildCodexRemediationPrompt,
  evaluateMergePolicy,
} from './remediation-policy.mjs';

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
  return `codex/vercel-remediation-${candidate.fingerprint}-${runId}`;
}

function parseStatusFiles(status) {
  return String(status || '')
    .split(/\r?\n/)
    .map((line) => line.slice(3).trim())
    .flatMap((line) => line.split(' -> '))
    .filter(Boolean);
}

function cleanupWorktree({ commandEnv, repoDir, runner, worktreeDir }) {
  if (!worktreeDir) {
    return;
  }
  runner('git', ['worktree', 'remove', '--force', worktreeDir], {
    cwd: repoDir,
    env: commandEnv,
    shell: false,
  });
}

function prBodyFor(candidate) {
  const sample = candidate.sample || {};
  return [
    'Automated remediation PR from the Vercel error remediator.',
    '',
    `Fingerprint: ${candidate.fingerprint}`,
    `Occurrences: ${candidate.occurrences}`,
    `Route: ${sample.route || '(unknown)'}`,
    `Deployment: ${sample.deploymentId || '(unknown)'}`,
    `Request: ${sample.requestId || '(unknown)'}`,
    '',
    'The worker is policy-gated. Protected files require human handling.',
  ].join('\n');
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
  const worktreeRoot =
    env.BACI_REMEDIATION_WORKTREE_ROOT ||
    join(dirname(repoDir), 'baci-remediation-worktrees');
  const worktreeDir = join(worktreeRoot, `${candidate.fingerprint}-${runId}`);
  const rootCommandOptions = { cwd: repoDir, env: commandEnv, runner };
  const worktreeCommandOptions = { cwd: worktreeDir, env: commandEnv, runner };
  const codexBin = env.CODEX_BIN || 'codex';
  const ghBin = env.GH_BIN || 'gh';
  let worktreeCreated = false;

  try {
    runChecked('git', ['fetch', 'origin', 'main'], rootCommandOptions);
    runChecked(
      'git',
      ['worktree', 'add', worktreeDir, '-b', branch, 'origin/main'],
      rootCommandOptions
    );
    worktreeCreated = true;
    runChecked(
      codexBin,
      [
        '--search',
        'exec',
        '--skip-git-repo-check',
        '--sandbox',
        'workspace-write',
        '-C',
        worktreeDir,
        prompt,
      ],
      worktreeCommandOptions
    );

    const status = runChecked(
      'git',
      ['status', '--porcelain'],
      worktreeCommandOptions
    );
    if (!status.trim()) {
      return { branch, type: 'no_changes', worktreeDir };
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
        type: 'policy_blocked',
        worktreeDir,
      };
    }
    runChecked('bash', ['-lc', verifyCommand], worktreeCommandOptions);

    runChecked('git', ['add', '-A'], worktreeCommandOptions);
    runChecked(
      'git',
      ['commit', '-m', `Fix Vercel error ${candidate.fingerprint}`],
      worktreeCommandOptions
    );
    runChecked('git', ['push', '-u', 'origin', branch], worktreeCommandOptions);
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
        `Fix Vercel error ${candidate.fingerprint}`,
        '--body',
        prBodyFor(candidate),
      ],
      worktreeCommandOptions
    ).trim();

    if (env.BACI_REMEDIATION_REQUEST_AUTO_MERGE === '1') {
      runChecked(
        ghBin,
        ['pr', 'merge', prUrl, '--auto', '--squash'],
        worktreeCommandOptions
      );
      return {
        branch,
        changedFiles,
        prUrl,
        type: 'auto_merge_requested',
        worktreeDir,
      };
    }

    return { branch, changedFiles, prUrl, type: 'pr_opened', worktreeDir };
  } finally {
    if (worktreeCreated) {
      cleanupWorktree({ commandEnv, repoDir, runner, worktreeDir });
    }
  }
}
