import type { ChildProcessWithoutNullStreams } from 'node:child_process';

type SessionLike = { child: ChildProcessWithoutNullStreams };

export async function terminateProductDescriptionAttestationSession(
  value: SessionLike | undefined
): Promise<void> {
  if (
    !value ||
    value.child.exitCode !== null ||
    value.child.signalCode !== null
  ) {
    return;
  }

  await new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      value.child.off('close', finish);
      value.child.off('error', finish);
      resolve();
    };
    const timeout = setTimeout(() => {
      value.child.kill('SIGKILL');
      finish();
    }, 1_000);

    value.child.once('close', finish);
    value.child.once('error', finish);
    if (!value.child.kill('SIGTERM')) finish();
  });
}
