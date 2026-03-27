const MIN_REQUEST_INTERVAL_MS = 250;
const RATE_LIMITER_TTL_MS = 5 * 60 * 1000;
const JUMIA_RATE_LIMITER_KEY = '__baciJumiaRequestLimiter';

type JumiaRateLimiterState = {
  gateByKey: Map<string, Promise<void>>;
  lastRequestAtByKey: Map<string, number>;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getSharedJumiaRateLimiter(): JumiaRateLimiterState {
  const scope = globalThis as typeof globalThis & {
    [JUMIA_RATE_LIMITER_KEY]?: JumiaRateLimiterState;
  };

  scope[JUMIA_RATE_LIMITER_KEY] ??= {
    gateByKey: new Map(),
    lastRequestAtByKey: new Map(),
  };

  const limiter = scope[JUMIA_RATE_LIMITER_KEY];
  const now = Date.now();

  for (const [rateLimitKey, lastRequestAt] of limiter.lastRequestAtByKey) {
    if (
      !limiter.gateByKey.has(rateLimitKey) &&
      now - lastRequestAt > RATE_LIMITER_TTL_MS
    ) {
      limiter.lastRequestAtByKey.delete(rateLimitKey);
    }
  }

  return limiter;
}

export async function waitForJumiaRequestSlot(
  rateLimitKey: string
): Promise<void> {
  const limiter = getSharedJumiaRateLimiter();
  const previousGate = limiter.gateByKey.get(rateLimitKey) ?? Promise.resolve();
  let releaseGate!: () => void;
  const currentGate = new Promise<void>((resolve) => {
    releaseGate = resolve;
  });

  limiter.gateByKey.set(rateLimitKey, currentGate);

  try {
    await previousGate;
    const lastRequestAt = limiter.lastRequestAtByKey.get(rateLimitKey) ?? 0;
    const elapsed = Date.now() - lastRequestAt;

    if (elapsed < MIN_REQUEST_INTERVAL_MS) {
      await sleep(MIN_REQUEST_INTERVAL_MS - elapsed);
    }

    limiter.lastRequestAtByKey.set(rateLimitKey, Date.now());
  } finally {
    releaseGate();
    if (limiter.gateByKey.get(rateLimitKey) === currentGate) {
      limiter.gateByKey.delete(rateLimitKey);
    }
  }
}

export function resetJumiaRateLimiterForTests(): void {
  const scope = globalThis as typeof globalThis & {
    [JUMIA_RATE_LIMITER_KEY]?: JumiaRateLimiterState;
  };

  delete scope[JUMIA_RATE_LIMITER_KEY];
}

export { MIN_REQUEST_INTERVAL_MS, RATE_LIMITER_TTL_MS };
