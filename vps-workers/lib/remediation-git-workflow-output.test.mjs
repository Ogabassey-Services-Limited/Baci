import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { runRemediationAutofix } from './remediation-git-workflow.mjs';
import { remediationGitWorkflowTestFixtures } from './remediation-git-workflow.test-helpers.mjs';

const { candidate, makeRunner } = remediationGitWorkflowTestFixtures;

describe('remediation git workflow output', () => {
  it('preserves Codex output when an investigation makes no changes', () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'baci-remediation-output-'));
    const { runner: baseRunner } = makeRunner({ statusOutput: '' });
    const runner = (command, args, options) => {
      if (command === 'codex') {
        return {
          status: 0,
          stdout:
            '{"type":"item.completed","item":{"text":"The event is a successful HTTP 200 and needs no code fix."}}\n{"type":"turn.completed"}\n',
          stderr: '',
        };
      }
      return baseRunner(command, args, options);
    };

    const result = runRemediationAutofix({
      candidate,
      env: {
        BACI_REMEDIATION_VERIFY_COMMAND: 'pnpm turbo lint',
        BACI_REMEDIATION_OUTPUT_DIR: outputDir,
        BACI_REPO_DIR: '/repo',
        BACI_REMEDIATION_RUN_ID: 'report-run',
        BACI_REMEDIATION_WORKTREE_ROOT: '/worktrees',
      },
      runner,
    });

    assert.equal(result.type, 'no_changes');
    assert.equal(
      result.resultPath,
      join(outputDir, 'unknown-unknown-abc123.result.md')
    );
    assert.match(
      readFileSync(result.resultPath, 'utf8'),
      /successful HTTP 200/
    );
  });

  it('redacts credentials before persisting the Codex result artifact', () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'baci-remediation-output-'));
    const { runner: baseRunner } = makeRunner({ statusOutput: '' });
    const runner = (command, args, options) =>
      command === 'codex'
        ? {
            status: 0,
            stdout:
              '{"type":"item.completed","item":{"text":"api_key=sk-proj-abcdefghijklmnopqrstuvwxyz0123456789"}}\n{"type":"turn.completed"}\n',
            stderr: '',
          }
        : baseRunner(command, args, options);

    const result = runRemediationAutofix({
      candidate,
      env: {
        BACI_REMEDIATION_VERIFY_COMMAND: 'pnpm turbo lint',
        BACI_REMEDIATION_OUTPUT_DIR: outputDir,
        BACI_REPO_DIR: '/repo',
        BACI_REMEDIATION_RUN_ID: 'redacted-artifact',
        BACI_REMEDIATION_WORKTREE_ROOT: '/worktrees',
      },
      runner,
    });

    const artifact = readFileSync(result.resultPath, 'utf8');
    assert.doesNotMatch(
      artifact,
      /sk-proj-abcdefghijklmnopqrstuvwxyz0123456789/
    );
    assert.match(artifact, /\[REDACTED\]/);
  });

  it('redacts prefixed provider secret assignment values in Codex artifacts', () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'baci-remediation-output-'));
    const stripeLikeToken = [
      'sk',
      'live',
      'abcdefghijklmnopqrstuvwxyz012345',
    ].join('_');
    const { runner: baseRunner } = makeRunner({ statusOutput: '' });
    const runner = (command, args, options) =>
      command === 'codex'
        ? {
            status: 0,
            stdout: `${JSON.stringify({
              type: 'item.completed',
              item: { text: `PAYSTACK_SECRET_KEY=${stripeLikeToken}` },
            })}\n{"type":"turn.completed"}\n`,
            stderr: '',
          }
        : baseRunner(command, args, options);

    const result = runRemediationAutofix({
      candidate,
      env: {
        BACI_REMEDIATION_VERIFY_COMMAND: 'pnpm turbo lint',
        BACI_REMEDIATION_OUTPUT_DIR: outputDir,
        BACI_REPO_DIR: '/repo',
        BACI_REMEDIATION_RUN_ID: 'paystack-artifact',
        BACI_REMEDIATION_WORKTREE_ROOT: '/worktrees',
      },
      runner,
    });

    const artifact = readFileSync(result.resultPath, 'utf8');
    assert.equal(artifact.includes(stripeLikeToken), false);
    assert.match(artifact, /PAYSTACK_SECRET_KEY=\[REDACTED\]/);
  });

  it('rejects a sandbox-blocked investigation before marking it handled', () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'baci-remediation-output-'));
    const { runner: baseRunner } = makeRunner({ statusOutput: '' });
    const runner = (command, args, options) =>
      command === 'codex'
        ? {
            status: 0,
            stdout:
              'bwrap: loopback: Failed RTM_NEWADDR: Operation not permitted',
            stderr: '',
          }
        : baseRunner(command, args, options);

    assert.throws(
      () =>
        runRemediationAutofix({
          candidate,
          env: {
            BACI_REMEDIATION_VERIFY_COMMAND: 'pnpm turbo lint',
            BACI_REMEDIATION_OUTPUT_DIR: outputDir,
            BACI_REPO_DIR: '/repo',
            BACI_REMEDIATION_WORKTREE_ROOT: '/worktrees',
          },
          runner,
        }),
      /sandbox failed before repository inspection/
    );
  });

  it('preserves a late Codex quota error from stderr in the bounded failure', () => {
    const { runner: baseRunner } = makeRunner();
    const runner = (command, args, options) =>
      command === 'codex'
        ? {
            status: 1,
            stdout: 'Codex banner\n'.repeat(300),
            stderr: `${'Codex banner\n'.repeat(300)}You have reached your Codex usage limits for code reviews.`,
          }
        : baseRunner(command, args, options);

    assert.throws(
      () =>
        runRemediationAutofix({
          candidate,
          env: {
            BACI_REMEDIATION_VERIFY_COMMAND: 'pnpm turbo lint',
            BACI_REPO_DIR: '/repo',
            BACI_REMEDIATION_WORKTREE_ROOT: '/worktrees',
          },
          runner,
        }),
      /You have reached your Codex usage limits for code reviews\./
    );
  });

  it('redacts a bearer token that crosses the bounded stderr tail', () => {
    const { runner: baseRunner } = makeRunner();
    const token = 'z'.repeat(2_500);
    const context = 'quota exceeded\n';
    const runner = (command, args, options) =>
      command === 'codex'
        ? {
            status: 1,
            stderr: `Authorization: Bearer ${token}\n${context}`,
            stdout: '',
          }
        : baseRunner(command, args, options);

    assert.throws(
      () =>
        runRemediationAutofix({
          candidate,
          env: {
            BACI_REMEDIATION_VERIFY_COMMAND: 'pnpm turbo lint',
            BACI_REPO_DIR: '/repo',
            BACI_REMEDIATION_WORKTREE_ROOT: '/worktrees',
          },
          runner,
        }),
      (error) => {
        assert.match(error.message, /quota exceeded/);
        assert.equal(error.message.includes(token.slice(-100)), false);
        return true;
      }
    );
  });
});
