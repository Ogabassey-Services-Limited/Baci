export function isTestSourcePath(path: string): boolean {
  return /\.(?:test|tests|spec|specs|test-suite|test-(?:support|helpers?|fixtures?))\.(?:cjs|cts|js|jsx|mjs|mts|ts|tsx)$/.test(
    path
  );
}
