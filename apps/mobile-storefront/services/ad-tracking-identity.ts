import type { AdTrackingUserProperties } from './ad-tracking.types';
import {
  clearCachedUserData,
  getAdTrackingModules,
  getIsTikTokInitialized,
  getIsTrackingAllowed,
  setCachedUserData,
} from './ad-tracking-state';
import {
  trackAddToCart as posthogAddToCart,
  identifyUser as posthogIdentify,
  trackOrderCompleted as posthogOrderCompleted,
  trackProductViewed as posthogProductViewed,
  resetUser as posthogReset,
  trackSearch as posthogSearch,
  trackEvent as posthogTrack,
} from './analytics';

export {
  posthogAddToCart,
  posthogOrderCompleted,
  posthogProductViewed,
  posthogSearch,
  posthogTrack,
};

// biome-ignore lint/suspicious/useAwait: async isolates tracking failures as promise rejections so a broken analytics provider can never crash the caller's user-facing flow (Codex review, #3084)
export async function identifyUser(
  userId: string,
  properties?: AdTrackingUserProperties
): Promise<void> {
  setCachedUserData(userId, properties);
  posthogIdentify(userId, {
    email: properties?.email,
    name:
      properties?.firstName && properties?.lastName
        ? `${properties.firstName} ${properties.lastName}`
        : undefined,
    phone: properties?.phone,
  });

  const modules = getAdTrackingModules();
  if (getIsTrackingAllowed() && properties?.email && modules.AppEventsLogger) {
    modules.AppEventsLogger.setUserData({
      email: properties.email,
      firstName: properties.firstName,
      lastName: properties.lastName,
      phone: properties.phone,
    });
  }

  if (
    getIsTrackingAllowed() &&
    getIsTikTokInitialized() &&
    modules.TikTokBusiness?.identify
  ) {
    modules.TikTokBusiness.identify(
      userId,
      undefined,
      properties?.phone,
      properties?.email
    );
  }
}

// biome-ignore lint/suspicious/useAwait: async isolates tracking failures as promise rejections so a broken analytics provider can never crash the caller's user-facing flow (Codex review, #3084)
export async function resetUserIdentity(): Promise<void> {
  clearCachedUserData();
  posthogReset();

  const modules = getAdTrackingModules();
  modules.AppEventsLogger?.clearUserID();
  modules.TikTokBusiness?.logout?.();
}
