import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { runTransition } from './install-remediation-cron-transition.test-helper.mjs';

describe('remediation cron transition', () => {
  it('holds deploy, global, and legacy locks through the crontab handoff', () => {
    const outcome = runTransition('interleaving');

    assert.equal(outcome.result.status, 0, outcome.result.stderr);
    assert.equal(outcome.locks.length, 4);
    assert.match(outcome.crontab, /error-remediator-global\.lock/);
  });

  it('blocks a direct launch after installing barrier-aware entrypoints', () => {
    const outcome = runTransition('launch-race');

    assert.equal(outcome.result.status, 0, outcome.result.stderr);
    assert.match(outcome.remoteEntry, /BARRIER_MARKER/);
  });

  it('waits for a pre-barrier documented direct job before rewriting the crontab', () => {
    const outcome = runTransition('direct-exit');

    assert.equal(outcome.result.status, 0, outcome.result.stderr);
    assert.match(outcome.crontab, /vercel-error-remediator/);
  });

  it('waits for a documented PATH-based Node job using an alternate binary', () => {
    const outcome = runTransition('alternate-node-exit');

    assert.equal(outcome.result.status, 0, outcome.result.stderr);
  });

  it('aborts and restores the barrier entrypoint when a legacy direct job does not drain', () => {
    const outcome = runTransition('direct-timeout');

    assert.notEqual(outcome.result.status, 0);
    assert.match(outcome.result.stderr, /legacy direct remediation processes/i);
    assert.equal(outcome.crontab, '');
    assert.match(outcome.remoteEntry, /setTimeout\(\(\) => \{\}, 5000\)/);
  });

  it('does not treat a target named as a watchdog argument as a direct remediator', () => {
    const outcome = runTransition('watchdog-argument');

    assert.equal(outcome.result.status, 0, outcome.result.stderr);
  });

  it('preserves comments and watchdog lines that only mention remediation targets', () => {
    const outcome = runTransition('preserve-unrelated');

    assert.equal(outcome.result.status, 0, outcome.result.stderr);
    assert.match(outcome.crontab, /watchdog mentions/);
    assert.match(
      outcome.crontab,
      /jobs\/watchdog\.mjs jobs\/vercel-error-remediator\.mjs/
    );
  });

  it('rolls barrier entrypoints back after a precommit crontab failure', () => {
    const outcome = runTransition('rollback');

    assert.notEqual(outcome.result.status, 0);
    assert.equal(outcome.crontab, '');
    assert.equal(outcome.remoteEntry, 'process.exitCode = 0;\n');
  });

  it('does not overwrite a concurrent operator crontab change during rollback', () => {
    const outcome = runTransition('operator-change');

    assert.notEqual(outcome.result.status, 0);
    assert.match(outcome.crontab, /operator-change/);
    assert.equal(outcome.remoteEntry, 'process.exitCode = 0;\n');
  });

  it('permits the genuine no-crontab response', () => {
    const outcome = runTransition('no-crontab');

    assert.equal(outcome.result.status, 0, outcome.result.stderr);
    assert.match(outcome.crontab, /vercel-error-remediator/);
  });

  it('fails closed without replacing the crontab when reading it fails', () => {
    const outcome = runTransition('read-error');

    assert.notEqual(outcome.result.status, 0);
    assert.match(outcome.result.stderr, /unable to read existing crontab/i);
    assert.equal(outcome.crontab, '');
  });

  it('fails closed before rewriting the crontab when proc inspection is unavailable', () => {
    const outcome = runTransition('proc-unavailable');

    assert.notEqual(outcome.result.status, 0);
    assert.match(outcome.result.stderr, /unable to inspect \/proc/i);
    assert.equal(outcome.crontab, '');
  });
});
