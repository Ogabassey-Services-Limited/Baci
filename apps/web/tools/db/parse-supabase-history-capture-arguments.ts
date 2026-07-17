export function parseSupabaseHistoryCaptureArguments(argv: readonly string[]): {
  refreshEffectsFixture?: true;
  refreshPostDeploy?: true;
  verifyOnly?: true;
} {
  const flags = new Set(argv);
  const modes = [
    flags.has('--refresh-effects-fixture'),
    flags.has('--refresh-post-deploy'),
    flags.has('--verify-only'),
  ].filter(Boolean).length;
  if (
    flags.size !== argv.length ||
    [...flags].some(
      (flag) =>
        flag !== '--refresh-effects-fixture' &&
        flag !== '--refresh-post-deploy' &&
        flag !== '--verify-only'
    ) ||
    modes > 1
  ) {
    throw new Error('Invalid Supabase history capture arguments');
  }
  return {
    ...(flags.has('--refresh-effects-fixture')
      ? { refreshEffectsFixture: true as const }
      : {}),
    ...(flags.has('--refresh-post-deploy')
      ? { refreshPostDeploy: true as const }
      : {}),
    ...(flags.has('--verify-only') ? { verifyOnly: true as const } : {}),
  };
}
