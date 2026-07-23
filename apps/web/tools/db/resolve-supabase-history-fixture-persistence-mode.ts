import type { SupabaseHistoryFixturePersistenceMode } from './persist-supabase-history-fixtures';

export function resolveSupabaseHistoryFixturePersistenceMode(options: {
  refreshEffectsFixture?: boolean;
  refreshPostDeploy?: boolean;
  verifyOnly?: boolean;
}): SupabaseHistoryFixturePersistenceMode {
  const selectedModes = [
    options.verifyOnly,
    options.refreshEffectsFixture,
    options.refreshPostDeploy,
  ].filter(Boolean).length;
  if (selectedModes > 1) throw new Error('Capture fixture mode is invalid');
  if (options.refreshPostDeploy) return 'refresh-post-deploy';
  if (options.refreshEffectsFixture) return 'refresh-effects';
  if (options.verifyOnly) return 'verify';
  return 'create';
}
