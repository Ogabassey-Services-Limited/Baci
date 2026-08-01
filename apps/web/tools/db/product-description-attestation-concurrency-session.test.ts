import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import { terminateProductDescriptionAttestationSession } from './product-description-attestation-concurrency-session';

function createChild() {
  const child = Object.assign(new EventEmitter(), {
    exitCode: null as number | null,
    kill: vi.fn((signal: NodeJS.Signals) => {
      child.signalCode = signal;
      child.emit('close', null, signal);
      return true;
    }),
    signalCode: null as NodeJS.Signals | null,
    stderr: new PassThrough(),
    stdin: new PassThrough(),
    stdout: new PassThrough(),
  });
  return child;
}

describe('terminateProductDescriptionAttestationSession', () => {
  it('terminates an open session without touching an already closed child', async () => {
    const child = createChild();

    await terminateProductDescriptionAttestationSession({
      child: child as unknown as ChildProcessWithoutNullStreams,
    });

    expect(child.kill).toHaveBeenCalledWith('SIGTERM');
  });

  it('does nothing when the session has already exited', async () => {
    const child = createChild();
    child.exitCode = 0;

    await terminateProductDescriptionAttestationSession({
      child: child as unknown as ChildProcessWithoutNullStreams,
    });

    expect(child.kill).not.toHaveBeenCalled();
  });
});
