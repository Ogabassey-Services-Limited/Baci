/** Keeps posthog-js behind a runtime boundary for eager error-boundary code. */
export function loadPostHogBrowserSdk() {
  return import('posthog-js');
}
