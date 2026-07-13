import 'server-only';

import type { PetrockClientFailure } from './petrock.types';

const TRANSIENT_HTTP_STATUSES = new Set([408, 425, 429]);

export function isDefinitivePetrockSubmissionRejection(
  failure: PetrockClientFailure
) {
  return (
    failure.kind === 'http' &&
    failure.status !== undefined &&
    failure.status >= 400 &&
    failure.status < 500 &&
    !TRANSIENT_HTTP_STATUSES.has(failure.status)
  );
}
