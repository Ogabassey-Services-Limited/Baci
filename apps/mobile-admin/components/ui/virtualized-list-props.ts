import { Platform } from 'react-native';

type SupportedPlatform = 'android' | 'ios' | (string & {});

export function getVirtualizedListProps(
  platformOs: SupportedPlatform = Platform.OS
) {
  // `removeClippedSubviews` improves memory/scroll performance on Android.
  // iOS clipping can cause rendering/measurement glitches, so we keep it off there.
  return {
    initialNumToRender: 15,
    maxToRenderPerBatch: 10,
    removeClippedSubviews: platformOs === 'android',
    windowSize: 5,
  };
}
