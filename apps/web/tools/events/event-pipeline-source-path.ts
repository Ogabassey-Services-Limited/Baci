export function isTestSourcePath(path: string): boolean {
  return /\.(?:test|spec)\.(?:mjs|tsx?)$/.test(path);
}
