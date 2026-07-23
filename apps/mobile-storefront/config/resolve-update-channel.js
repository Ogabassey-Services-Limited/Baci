const UPDATE_CHANNELS = new Set(['development', 'preview', 'production']);

function resolveUpdateChannel(environment) {
  const candidate =
    environment.EXPO_UPDATE_CHANNEL?.trim() ||
    environment.EXPO_PUBLIC_ENV?.trim() ||
    environment.EAS_BUILD_PROFILE?.trim() ||
    'production';

  return UPDATE_CHANNELS.has(candidate) ? candidate : 'production';
}

module.exports = { resolveUpdateChannel };
