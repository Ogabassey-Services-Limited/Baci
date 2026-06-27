let postHogBrowserInitialized = false;

export function hasPostHogBrowserInitialized(): boolean {
  return postHogBrowserInitialized;
}

export function markPostHogBrowserInitialized(): void {
  postHogBrowserInitialized = true;
}

export function resetPostHogBrowserInitializedForTests(): void {
  postHogBrowserInitialized = false;
}
