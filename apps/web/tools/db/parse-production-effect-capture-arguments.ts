import path from 'node:path';

function isSafeRepositoryRelativePath(value: string): boolean {
  return (
    !path.posix.isAbsolute(value) &&
    !path.win32.isAbsolute(value) &&
    !value.includes('\\') &&
    !value.split('/').includes('..') &&
    path.posix.normalize(value) === value
  );
}

export function parseProductionEffectCaptureArguments(
  argv: readonly string[]
): {
  refreshFixture?: true;
  semanticFixtureOutput?: string;
  verifyOnly?: true;
} {
  const options: {
    refreshFixture?: true;
    semanticFixtureOutput?: string;
    verifyOnly?: true;
  } = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--verify-only' && !options.verifyOnly) {
      options.verifyOnly = true;
      continue;
    }
    if (argument === '--refresh-fixture' && !options.refreshFixture) {
      options.refreshFixture = true;
      continue;
    }
    if (
      argument === '--semantic-fixture-output' &&
      options.semanticFixtureOutput === undefined &&
      argv[index + 1] &&
      !argv[index + 1]?.startsWith('-') &&
      isSafeRepositoryRelativePath(argv[index + 1])
    ) {
      options.semanticFixtureOutput = argv[index + 1];
      index += 1;
      continue;
    }
    throw new Error('Invalid production-effect capture arguments');
  }
  if (options.verifyOnly && options.refreshFixture) {
    throw new Error('Invalid production-effect capture arguments');
  }
  return options;
}
