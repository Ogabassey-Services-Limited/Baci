import { spawn } from 'child_process';

/**
 * Executes a command safely using spawn to avoid shell injection vulnerabilities.
 * @param command The command to run (e.g., 'scp', 'ssh', 'git')
 * @param args Array of arguments
 * @param cwd Optional working directory
 */
export function execSafe(command: string, args: string[] = [], cwd?: string): Promise<string> {
    return new Promise((resolve, reject) => {
        // console.log(`> ${command} ${args.join(' ')}`); // Verbose logging if needed

        const child = spawn(command, args, {
            cwd,
            shell: false, // Explicitly disable shell
            stdio: ['ignore', 'pipe', 'pipe'] // Capture stdout/stderr
        });

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        child.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        child.on('close', (code) => {
            if (code === 0) {
                resolve(stdout.trim());
            } else {
                reject(new Error(`Command failed with exit code ${code}\nStderr: ${stderr}`));
            }
        });

        child.on('error', (err) => {
            reject(err);
        });
    });
}
