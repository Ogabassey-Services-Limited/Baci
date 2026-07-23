const sourceExtensions = [
  'ts',
  'tsx',
  'js',
  'jsx',
  'mjs',
  'cjs',
  'mts',
  'cts',
] as const;

export const eventPipelineSourceFilePolicy = {
  isSourcePath(path: string): boolean {
    return /\.(?:cjs|cts|js|jsx|mjs|mts|ts|tsx)$/.test(path);
  },
  pathspecs: sourceExtensions.map((extension) => `*.${extension}`),
} as const;
