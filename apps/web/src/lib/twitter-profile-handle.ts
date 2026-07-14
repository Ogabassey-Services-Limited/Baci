const TWITTER_RESERVED_PATHS = new Set([
  'account',
  'communities',
  'compose',
  'explore',
  'hashtag',
  'home',
  'i',
  'intent',
  'login',
  'logout',
  'messages',
  'notifications',
  'search',
  'settings',
  'share',
  'signup',
  'topics',
  'who_to_follow',
]);

export function isValidTwitterProfileHandle(handle: string): boolean {
  return (
    /^[A-Za-z0-9_]{1,15}$/.test(handle) &&
    !TWITTER_RESERVED_PATHS.has(handle.toLowerCase())
  );
}
