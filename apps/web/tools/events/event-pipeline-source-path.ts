export function isTestSourcePath(path: string): boolean {
  return /\.(?:test|spec)\.(?:cjs|cts|js|jsx|mjs|mts|ts|tsx)$/.test(path);
}
