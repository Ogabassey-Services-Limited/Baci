import {
  type RuntimePlatform,
  selectRuntimePlatform,
} from './runtime-platform';

// Flip this to true and rebuild when Android domain purchasing is approved.
const ANDROID_DOMAIN_PURCHASE_ENABLED = false;

export function isDomainPurchaseEnabled(platform?: RuntimePlatform): boolean {
  return (
    selectRuntimePlatform(
      {
        android: ANDROID_DOMAIN_PURCHASE_ENABLED,
        default: true,
      },
      platform
    ) ?? true
  );
}
