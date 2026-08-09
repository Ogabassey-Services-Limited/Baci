import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import {
  buildRemediationCodexCommand,
  buildRemediationVerificationCommand,
} from './remediation-codex-command.mjs';
import {
  assertCodexExecutionUsable,
  formatBoundedSubprocessOutput,
  redactCodexError,
  redactCodexOutput,
} from './remediation-codex-output.mjs';
import { createRemediationDraftPrReconciler } from './remediation-draft-pr-reconciliation.mjs';
import { buildRemediationEnvironments } from './remediation-environments.mjs';
import {
  buildCodexRemediationPrompt,
  evaluateMergePolicy,
} from './remediation-policy.mjs';
import { writeRemediationResultArtifact } from './remediation-result-artifact.mjs';
import { findRetainedRemediationWorktree } from './remediation-retained-worktree.mjs';
import { parseRemediationStatusFiles } from './remediation-status-files.mjs';
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
    timeout: options.timeout,
  });
  if (result.error) throw redactCodexError(result.error);
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(' ')} failed: ${formatBoundedSubprocessOutput(result)}`
    );
  }
  return result.stdout || '';
}

function runCodexChecked(command, args, options) {
  const result = options.runner(command, args, {
    cwd: options.cwd,
    env: options.env,
    shell: false,
    timeout: options.timeout,
  });
  if (result.error) {
    throw redactCodexError(result.error);
  }
  assertCodexExecutionUsable(result);
  return {
    output: [
      result.stdout
        ? ['stdout:', redactCodexOutput(result.stdout)].join('\n')
        : '',
      result.stderr
        ? ['stderr:', redactCodexOutput(result.stderr)].join('\n')
        : '',
    ]
      .filter(Boolean)
      .join('\n'),
    stdout: redactCodexOutput(result.stdout || ''),
  };
}

function sanitizeRunId(value) {
  const runId = String(value || randomUUID())
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);
  return runId || randomUUID().toLowerCase().slice(0, 24);
}

function readPositiveInt(value, fallback) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function cleanupWorktree({ childEnv, repoDir, runner, worktreeDir }) {
  if (!worktreeDir) return;
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

  const verifyCommand = env.BACI_REMEDIATION_VERIFY_COMMAND;
  if (!verifyCommand) {
    return {
      reasons: ['BACI_REMEDIATION_VERIFY_COMMAND is required for autofix mode'],
      type: 'configuration_blocked',
    };
  }

  const runId = sanitizeRunId(env.BACI_REMEDIATION_RUN_ID);
  const commandEnv = { ...process.env, ...env };
  const {
    child: childEnv,
    gitIdentity: gitIdentityEnv,
    gitRemote: gitEnv,
  } = buildRemediationEnvironments(commandEnv);
  const worktreeRoot =
    env.BACI_REMEDIATION_WORKTREE_ROOT ||
    join(dirname(repoDir), 'baci-remediation-worktrees');
  let worktreeDir = join(worktreeRoot, `${candidate.fingerprint}-${runId}`);
  const rootCommandOptions = { cwd: repoDir, env: childEnv, runner };
  const rootRemoteCommandOptions = { cwd: repoDir, env: gitEnv, runner };
  const codexBin = env.CODEX_BIN || 'codex';
  const ghBin = env.GH_BIN || 'gh';
  const prReconciler = createRemediationDraftPrReconciler({
    candidate,
    ghBin,
    options: rootRemoteCommandOptions,
  });
  const { branch } = prReconciler;
  let cleanupCompletedWorktree = false;
  let worktreeCreated = false;
  try {
    runChecked('git', ['fetch', 'origin', 'main'], rootRemoteCommandOptions);
    const existingPrUrl = prReconciler.existingDraftPrUrl();
    if (existingPrUrl) {
      return {
        branch,
        changedFiles: [],
        prUrl: existingPrUrl,
        type: 'pr_opened',
        worktreeDir,
      };
    }
    if (prReconciler.remoteBranchExists()) {
      return {
        branch,
        changedFiles: [],
        prUrl: prReconciler.createOrReuseDraftPr(),
        type: 'pr_opened',
        worktreeDir,
      };
    }
    const retainedWorktreeDir = findRetainedRemediationWorktree({
      branch,
      childEnv,
      repoDir,
      runner,
    });
    if (retainedWorktreeDir) {
      worktreeDir = retainedWorktreeDir;
    } else {
      runChecked(
        'git',
        ['worktree', 'add', worktreeDir, '-b', branch, 'origin/main'],
        rootCommandOptions
      );
      worktreeCreated = true;
    }
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
    const codexCommand = buildRemediationCodexCommand({
      codexBin,
      env: commandEnv,
      prompt,
      repoDir,
      worktreeDir,
    });
    let codexExecution;
    try {
      codexExecution = runCodexChecked(
        codexCommand.command,
        codexCommand.args,
        {
          ...worktreeCommandOptions,
          timeout: readPositiveInt(env.BACI_CODEX_TIMEOUT_MS, 6 * 60 * 1000),
        }
      );
    } finally {
      if (codexCommand.cleanup) {
        runner(codexCommand.cleanup.command, codexCommand.cleanup.args, {
          cwd: worktreeDir,
          env: childEnv,
          shell: false,
        });
      }
    }
    const resultPath = writeRemediationResultArtifact({
      candidate,
      output: codexExecution.output,
      outputDir: env.BACI_REMEDIATION_OUTPUT_DIR,
    });
    const status = runChecked(
      'git',
      ['status', '--porcelain'],
      worktreeGitCommandOptions
    );
    if (!status.trim()) {
      cleanupCompletedWorktree = true;
      return { branch, resultPath, type: 'no_changes', worktreeDir };
    }

    const changedFiles = parseRemediationStatusFiles(status);
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

    const verificationCommand = buildRemediationVerificationCommand({
      env: commandEnv,
      repoDir,
      verifyCommand,
      worktreeDir,
    });
    try {
      runChecked(verificationCommand.command, verificationCommand.args, {
        ...worktreeCommandOptions,
        timeout: readPositiveInt(
          env.BACI_REMEDIATION_VERIFY_TIMEOUT_MS,
          30 * 60 * 1_000
        ),
      });
    } finally {
      if (verificationCommand.cleanup) {
        runner(
          verificationCommand.cleanup.command,
          verificationCommand.cleanup.args,
          { cwd: worktreeDir, env: childEnv, shell: false }
        );
      }
    }

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
    const prUrl = prReconciler.createOrReuseDraftPr();

    cleanupCompletedWorktree = true;
    return {
      branch,
      changedFiles,
      prUrl,
      resultPath,
      type: 'pr_opened',
      worktreeDir,
    };
  } finally {
    if (worktreeCreated && cleanupCompletedWorktree) {
      cleanupWorktree({ childEnv, repoDir, runner, worktreeDir });
    }
  }
}
