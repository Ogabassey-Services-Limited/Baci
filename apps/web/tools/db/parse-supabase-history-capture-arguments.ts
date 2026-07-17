export function parseSupabaseHistoryCaptureArguments(argv: readonly string[]): {
  refreshEffectsFixture?: true;
  verifyOnly?: true;
} {
  const flags = new Set(argv);
  if (
    flags.size !== argv.length ||
    [...flags].some(
      (flag) => flag !== '--refresh-effects-fixture' && flag !== '--verify-only'
    ) ||
    (flags.has('--refresh-effects-fixture') && flags.has('--verify-only'))
  ) {
    throw new Error('Invalid Supabase history capture arguments');
  }
  return {
    ...(flags.has('--refresh-effects-fixture')
      ? { refreshEffectsFixture: true as const }
      : {}),
    ...(flags.has('--verify-only') ? { verifyOnly: true as const } : {}),
  };
}
