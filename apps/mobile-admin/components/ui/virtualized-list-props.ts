import {
  getRuntimePlatform,
  type RuntimePlatform,
} from '@/config/runtime-platform';

export function getVirtualizedListProps(
  platformOs: RuntimePlatform = getRuntimePlatform()
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
