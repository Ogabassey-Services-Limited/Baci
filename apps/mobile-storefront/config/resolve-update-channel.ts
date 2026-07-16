const UPDATE_CHANNELS = new Set(['development', 'preview', 'production']);

export function resolveUpdateChannel(
  environment: Readonly<Record<string, string | undefined>>
): string {
  const candidate =
    environment.EXPO_UPDATE_CHANNEL?.trim() ||
    environment.EXPO_PUBLIC_ENV?.trim() ||
    environment.EAS_BUILD_PROFILE?.trim() ||
    'production';

  return UPDATE_CHANNELS.has(candidate) ? candidate : 'production';
}
