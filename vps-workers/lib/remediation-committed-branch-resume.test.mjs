import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resumeCommittedRemediationBranch } from './remediation-committed-branch-resume.mjs';

describe('committed remediation branch resume', () => {
  it('pushes, creates a draft, and cleans a branch ahead of origin/main', () => {
    const calls = [];
    const runner = (command, args, options) => {
      calls.push({ args, command, options });
      if (args[0] === 'rev-list') return { status: 0, stdout: '1\n' };
      return { status: 0, stdout: '' };
    };
    const result = resumeCommittedRemediationBranch({
      prReconciler: {
        branch: 'codex/fix-abc123',
        createOrReuseDraftPr: () =>
          'https://github.com/ogabasseyy/Baci/pull/999',
      },
      rootCommandOptions: {
        cwd: '/repo',
        env: { PATH: '/safe/bin' },
        runner,
      },
      worktreeGitCommandOptions: { cwd: '/worktrees/abc123', env: {}, runner },
      worktreeRemoteCommandOptions: {
        cwd: '/worktrees/abc123',
        env: {},
        runner,
      },
    });

    assert.equal(result.type, 'pr_opened');
    assert.equal(
      calls.at(-1).args.join(' '),
      'worktree remove --force /worktrees/abc123'
    );
    assert.deepEqual(calls.at(-1).options, {
      cwd: '/repo',
      env: { PATH: '/safe/bin' },
      shell: false,
    });
  });

  it('leaves a branch at origin/main untouched', () => {
    const calls = [];
    const runner = (command, args, options) => {
      calls.push({ args, command, options });
      return { status: 0, stdout: '0\n' };
    };

    const result = resumeCommittedRemediationBranch({
      prReconciler: { branch: 'codex/fix-abc123' },
      rootCommandOptions: { cwd: '/repo', env: {}, runner },
      worktreeGitCommandOptions: { cwd: '/worktrees/abc123', env: {}, runner },
      worktreeRemoteCommandOptions: {
        cwd: '/worktrees/abc123',
        env: {},
        runner,
      },
    });

    assert.equal(result, null);
    assert.equal(calls.length, 1);
  });
});
