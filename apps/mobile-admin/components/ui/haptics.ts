import * as Haptics from 'expo-haptics';

export function triggerLightHaptic() {
  if (process.env.EXPO_OS !== 'ios') {
    return;
  }

  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {
    // Haptics are optional feedback; failures should never block navigation.
  });
}
