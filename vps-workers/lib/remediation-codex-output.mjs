const EXECUTION_FAILURES = [
  /bwrap: loopback: Failed RTM_NEWADDR: Operation not permitted/i,
  /permission profiles requiring direct runtime enforcement are incompatible with --use-legacy-landlock/i,
];

export function assertCodexExecutionUsable(output) {
  const text = String(output || '');
  const failure = EXECUTION_FAILURES.find((pattern) => pattern.test(text));
  if (failure) {
    throw new Error(
      'Codex execution sandbox failed before repository inspection'
    );
  }
}
