import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import {
  chmod,
  mkdir,
  mkdtemp,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const script = new URL('./retire-ollama.sh', import.meta.url);

test('resolves a container listener through its container root', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'baci-container-listener-'));
  const bin = join(directory, 'bin');
  const procRoot = join(directory, 'proc');
  const processRoot = join(procRoot, '41');
  const processes = join(directory, 'processes');
  const ports = join(directory, 'ports.json');
  try {
    await mkdir(bin);
    await mkdir(join(procRoot, 'net'), { recursive: true });
    await mkdir(join(processRoot, 'fd'), { recursive: true });
    await mkdir(join(processRoot, 'ns'), { recursive: true });
    await mkdir(join(processRoot, 'root', 'opt', 'ollama', 'bin'), {
      recursive: true,
    });
    await writeFile(
      join(procRoot, 'net', 'tcp'),
      'sl local_address rem_address st tx_queue tr tm->when retrnsmt uid timeout inode\n0: 0100007F:2CAA 00000000:0000 0A 00000000:00000000 00:00000000 00000000 0 0 999\n'
    );
    await writeFile(
      join(procRoot, 'net', 'tcp6'),
      'sl local_address rem_address st tx_queue tr tm->when retrnsmt uid timeout inode\n'
    );
    await writeFile(join(processRoot, 'cgroup'), '0::/docker/container\n');
    await writeFile(
      join(processRoot, 'stat'),
      `41 (ollama) ${Array.from({ length: 20 }, () => '1').join(' ')}\n`
    );
    await writeFile(
      join(processRoot, 'status'),
      'Uid:\t1000\t1000\t1000\t1000\n'
    );
    await writeFile(
      join(processRoot, 'root', 'opt', 'ollama', 'bin', 'ollama'),
      '#!/bin/sh\n'
    );
    await chmod(
      join(processRoot, 'root', 'opt', 'ollama', 'bin', 'ollama'),
      0o755
    );
    await writeFile(join(processRoot, 'ns', 'pid:[4026533000]'), '');
    await symlink('pid:[4026533000]', join(processRoot, 'ns', 'pid'));
    await symlink('/opt/ollama/bin/ollama', join(processRoot, 'exe'));
    await symlink('socket:[999]', join(processRoot, 'fd', '3'));
    await writeFile(processes, '41 1 /opt/ollama/bin/ollama serve\n');
    await writeFile(ports, '{}\n');
    await writeFile(
      join(bin, 'readlink'),
      '#!/bin/sh\nmode=$1; for path do :; done\ncase "$mode:$path" in -f:*/41/exe) exit 1;; -f:*/41/root/opt/ollama/bin/ollama) printf "/opt/ollama/bin/ollama\\n";; --:*/41/exe) printf "/opt/ollama/bin/ollama\\n";; *) exec /usr/bin/readlink "$@";; esac\n'
    );
    await writeFile(
      join(bin, 'stat'),
      '#!/bin/sh\nprintf "1:2:1000:1000:755\\n"\n'
    );
    await writeFile(
      join(bin, 'sha256sum'),
      '#!/bin/sh\nprintf "%064d  %s\\n" 0 "$1"\n'
    );
    await Promise.all(
      ['readlink', 'stat', 'sha256sum'].map((name) =>
        chmod(join(bin, name), 0o755)
      )
    );

    const { stdout } = await execFileAsync(
      'sh',
      [
        '-c',
        '. "$1"; SCRIPT_DIR=$(dirname "$1"); . "$SCRIPT_DIR/retire-ollama-recovery.sh"; RECOVERY_PROC_ROOT="$2"; ports=$3; processes=$4; RECOVERY_CONTAINER_COMMAND_PATH=/opt/ollama/bin/ollama; init_temp_root; trap cleanup_temp EXIT; identity=$(recovery_process_identity 41); set -- $identity; recovery_socket_snapshot 41 "$1" "$2" "$ports" "$processes"; printf "%s\\n" "$RECOVERY_LISTENING_SOCKETS"',
        'retire-ollama-recovery-listener-resolution-test',
        script.pathname,
        procRoot,
        ports,
        processes,
      ],
      { env: { ...process.env, RETIRE_OLLAMA_TEST_BIN: bin } }
    );
    const [listener] = JSON.parse(stdout);
    assert.equal(listener.class, 'container');
    assert.equal(listener.executable.expected, '/opt/ollama/bin/ollama');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
