import { execFile } from 'node:child_process';
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const script = new URL('./retire-ollama.sh', import.meta.url);

test('captures an endpoint at the end of a long argv with finite COLUMNS', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'baci-cwv-recovery-ps-'));
  const ps = join(directory, 'ps');
  const output = join(directory, 'processes');
  try {
    await writeFile(
      ps,
      `#!/bin/sh
case " $* " in
  *" -ww "*) /usr/bin/printf '%s\\n' '42 1 /usr/bin/ollama serve --padding=abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz https://127.0.0.1:11434';;
  *) /usr/bin/printf '%s\\n' '42 1 /usr/bin/ollama serve --padding=abcdefgh...';;
esac
`
    );
    await chmod(ps, 0o755);
    await execFileAsync(
      'sh',
      [
        '-c',
        `. "$1"; SCRIPT_DIR=$(dirname "$1"); . "$SCRIPT_DIR/retire-ollama-recovery.sh"; COLUMNS=8; recovery_ps >"$2"; grep -Fqx '42 1 /usr/bin/ollama serve --padding=abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz https://127.0.0.1:11434' "$2"`,
        'recovery-ps-width-test',
        script.pathname,
        output,
      ],
      {
        env: {
          ...process.env,
          PATH: `${directory}:${process.env.PATH}`,
          RETIRE_OLLAMA_TEST_BIN: directory,
        },
      }
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
