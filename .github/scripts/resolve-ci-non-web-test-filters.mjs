const NON_WEB_TEST_FILTER = '--filter=!@baci/web';

/**
 * Select affected pull-request packages without allowing the full web suite
 * to leak into the non-web job. The web suite has its own shard matrix.
 */
export function resolveNonWebTestFilterArgs({ baseRef, eventName }) {
  if (eventName !== 'pull_request') {
    return [NON_WEB_TEST_FILTER];
  }

  return [`--filter=...[${baseRef}]`, NON_WEB_TEST_FILTER];
}
