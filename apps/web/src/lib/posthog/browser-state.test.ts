import { describe, expect, it } from 'vitest';
import {
  hasPostHogBrowserInitialized,
  markPostHogBrowserInitialized,
  resetPostHogBrowserInitializedForTests,
} from './browser-state';

describe('PostHog browser state', () => {
  it('tracks whether the full browser client has initialized', () => {
    resetPostHogBrowserInitializedForTests();

    expect(hasPostHogBrowserInitialized()).toBe(false);

    markPostHogBrowserInitialized();

    expect(hasPostHogBrowserInitialized()).toBe(true);

    resetPostHogBrowserInitializedForTests();

    expect(hasPostHogBrowserInitialized()).toBe(false);
  });
});
