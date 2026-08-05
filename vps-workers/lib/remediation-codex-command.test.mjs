import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildRemediationCodexCommand } from './remediation-codex-command.mjs';

describe('remediation Codex command', () => {
  it('uses the native workspace sandbox by default', () => {
    const result = buildRemediationCodexCommand({
      codexBin: 'codex',
      env: { HOME: '/home/worker' },
      prompt: 'Investigate safely.',
      repoDir: '/repo',
      worktreeDir: '/worktree',
    });

    assert.equal(result.command, 'codex');
    assert.deepEqual(result.args.slice(0, 3), [
      '--search',
      'exec',
      '--ephemeral',
    ]);
    assert.equal(result.args.includes('use_legacy_landlock'), false);
    assert.equal(result.args.includes('workspace-write'), true);
  });

  it('isolates VPS Codex inside a capability-free Docker container', () => {
    const result = buildRemediationCodexCommand({
      codexBin: '/opt/host/codex',
      env: {
        BACI_CODEX_DOCKER_IMAGE: 'baci-codex-remediator:local',
        CODEX_HOME: '/home/worker/.codex',
        HOME: '/home/worker',
      },
      prompt: 'Investigate safely.',
      repoDir: '/repo',
      worktreeDir: '/worktree',
    });

    assert.equal(result.command, 'docker');
    assert.equal(result.args.includes('ALL'), true);
    assert.equal(result.args.includes('no-new-privileges'), true);
    assert.equal(
      result.args.includes('--dangerously-bypass-approvals-and-sandbox'),
      true
    );
    assert.equal(result.args.includes('--ignore-user-config'), true);
    assert.equal(
      result.args.includes('type=bind,src=/worktree,dst=/worktree'),
      true
    );
    assert.equal(
      result.args.includes(
        'type=bind,src=/home/worker/.codex/auth.json,dst=/codex-auth/auth.json,readonly'
      ),
      true
    );
    assert.equal(result.args.includes('CODEX_HOME=/tmp/codex-home'), true);
    assert.equal(
      result.args.includes('type=bind,src=/repo/.git,dst=/repo/.git,readonly'),
      true
    );
  });
});
