import { spawn } from 'node:child_process';

interface ExecSafeOptions {
    cwd?: string;
    timeoutMs?: number;
}

/**
 * Executes a command safely using spawn to avoid shell injection vulnerabilities.
 * Uses shell: false to prevent command injection attacks.
 *
 * @param command The command to run (e.g., 'scp', 'ssh', 'git')
 * @param args Array of arguments (will NOT be shell-interpreted)
 * @param options Optional configuration (cwd, timeoutMs)
 * @returns Promise resolving to stdout on success
 */
export function execSafe(
    command: string,
    args: string[] = [],
    options?: ExecSafeOptions | string
): Promise<string> {
    // Support legacy signature: execSafe(cmd, args, cwd)
    const opts: ExecSafeOptions = typeof options === 'string'
        ? { cwd: options }
        : options ?? {};

    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            cwd: opts.cwd,
            shell: false, // Explicitly disable shell to prevent injection
            stdio: ['ignore', 'pipe', 'pipe']
        });

        let stdout = '';
        let stderr = '';
        let timeoutId: NodeJS.Timeout | undefined;
        let killed = false;

        // Set up timeout if specified (default: 5 minutes for long operations like scp)
        const timeoutMs = opts.timeoutMs ?? 300000;
        if (timeoutMs > 0) {
            timeoutId = setTimeout(() => {
                killed = true;
                child.kill('SIGKILL');
            }, timeoutMs);
        }

        child.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        child.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        child.on('close', (code, signal) => {
            if (timeoutId) clearTimeout(timeoutId);

            if (killed) {
                reject(new Error(`Command timed out after ${timeoutMs}ms: ${command} ${args.join(' ')}`));
                return;
            }

            if (code === 0) {
                resolve(stdout.trim());
            } else if (signal) {
                reject(new Error(`Command killed by signal ${signal}: ${command}\nStderr: ${stderr}`));
            } else {
                reject(new Error(`Command failed with exit code ${code}: ${command}\nStderr: ${stderr}`));
            }
        });

        child.on('error', (err) => {
            if (timeoutId) clearTimeout(timeoutId);
            reject(err);
        });
    });
}
