import { posthogSearch, posthogTrack } from './ad-tracking-identity';
import {
  generateEventIdSync,
  trackAemEvent,
  trackFacebookEvent,
  trackTikTokEvent,
} from './ad-tracking-runtime';
import { sendServerConversion } from './ad-tracking-server-conversion';

// biome-ignore lint/suspicious/useAwait: async isolates tracking failures as promise rejections so a broken analytics provider can never crash the caller's user-facing flow (Codex review, #3084)
export async function trackSearch(
  query: string,
  resultCount: number
): Promise<void> {
  const eventId = generateEventIdSync();

  posthogSearch(query, resultCount);
  sendServerConversion('SEARCH', eventId, { searchString: query });
  trackFacebookEvent('fb_mobile_search', {
    fb_search_string: query,
    _eventId: eventId,
  });
  trackTikTokEvent('Search', eventId, { query });
}

// biome-ignore lint/suspicious/useAwait: async isolates tracking failures as promise rejections so a broken analytics provider can never crash the caller's user-facing flow (Codex review, #3084)
export async function trackAppOpen(): Promise<void> {
  trackFacebookEvent('fb_mobile_activate_app');
}

export async function trackScreenView(
  _screenName: string,
  _screenClass?: string
): Promise<void> {
  // Not yet wired to a provider; kept as a stable async no-op call site.
}

// biome-ignore lint/suspicious/useAwait: async isolates tracking failures as promise rejections so a broken analytics provider can never crash the caller's user-facing flow (Codex review, #3084)
export async function trackSignup(
  method: string,
  userData?: { email?: string; phone?: string; userId?: string }
): Promise<void> {
  const eventId = generateEventIdSync();

  sendServerConversion('SIGN_UP', eventId, {
    email: userData?.email,
    phone: userData?.phone,
    userId: userData?.userId,
  });
  trackFacebookEvent('fb_mobile_complete_registration', {
    fb_registration_method: method,
    _eventId: eventId,
  });
  trackAemEvent('fb_mobile_complete_registration', 0, 'NGN', {
    fb_registration_method: method,
  });
  trackTikTokEvent('Registration', eventId, {
    registration_method: method,
  });
}

export async function trackLogin(_method: string): Promise<void> {
  // Not yet wired to a provider; kept as a stable async no-op call site.
}

// biome-ignore lint/suspicious/useAwait: async isolates tracking failures as promise rejections so a broken analytics provider can never crash the caller's user-facing flow (Codex review, #3084)
export async function trackCustomEvent(
  eventName: string,
  params?: Record<string, string | number | boolean>
): Promise<void> {
  const eventId = generateEventIdSync();

  posthogTrack(eventName, params);
  const fbParams = params
    ? Object.fromEntries(
        Object.entries(params).map(([key, value]) => [key, String(value)])
      )
    : {};
  trackFacebookEvent(eventName, { ...fbParams, _eventId: eventId });
  trackTikTokEvent(eventName, eventId, params);
}
