const candidate = {
  fingerprint: 'abc123',
  occurrences: 3,
  sample: {
    message: 'TypeError: Cannot read properties of undefined',
    route: '/api/products',
  },
};

function makeRunner({
  changedFiles,
  cleanupResult,
  remediationResult,
  statusOutput,
  verificationResult,
} = {}) {
  const calls = [];
  const environments = [];
  return {
    calls,
    environments,
    runner(command, args, options) {
      calls.push([command, ...args]);
      environments.push({
        args,
        command,
        env: options?.env || {},
        timeout: options?.timeout,
      });
      const joined = [command, ...args].join(' ');
      if (joined.includes('rev-list --count origin/main..HEAD')) {
        return { status: 0, stdout: '0\n', stderr: '' };
      }
      if (joined.includes('status --porcelain')) {
        return {
          status: 0,
          stdout:
            statusOutput ??
            (changedFiles ?? 'apps/web/src/components/cart.tsx\n')
              .split('\n')
              .filter(Boolean)
              .map((path) => ` M ${path}`)
              .join('\n'),
          stderr: '',
        };
      }
      if (joined.includes('pr list')) {
        return { status: 0, stdout: '[]\n', stderr: '' };
      }
      if (joined.includes('pr create')) {
        return {
          status: 0,
          stdout: 'https://github.com/ogabasseyy/Baci/pull/999\n',
          stderr: '',
        };
      }
      if (command === 'codex') {
        return (
          remediationResult ?? {
            status: 0,
            stdout: '{"type":"turn.completed"}\n',
            stderr: '',
          }
        );
      }
      if (command === 'bash') {
        return verificationResult ?? { status: 0, stdout: '', stderr: '' };
      }
      if (command === 'docker') {
        if (args[0] === 'rm') {
          return cleanupResult ?? { status: 0, stdout: '', stderr: '' };
        }
        return args.includes('--dangerously-bypass-approvals-and-sandbox')
          ? (remediationResult ?? {
              status: 0,
              stdout: '{"type":"turn.completed"}\n',
              stderr: '',
            })
          : (verificationResult ?? { status: 0, stdout: '', stderr: '' });
      }
      return { status: 0, stdout: '', stderr: '' };
    },
  };
}

export const remediationGitWorkflowTestFixtures = { candidate, makeRunner };
