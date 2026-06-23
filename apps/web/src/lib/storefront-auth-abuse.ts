import { createHash } from 'node:crypto';
import { getRedis } from '@/lib/redis';

const SEND_WINDOW_MS = 60_000;
const SEND_MAX_ATTEMPTS = 4;
const SEND_CAPTCHA_AFTER_ATTEMPTS = 2;
const VERIFY_LOCKOUT_WINDOW_MS = 24 * 60 * 60 * 1000;
const VERIFY_MAX_FAILURES = 10;

type WindowCounter = {
  count: number;
  resetTime: number;
};

type StorefrontAuthRateLimitResult = {
  allowed: boolean;
  captchaRequired: boolean;
  limit: number;
  remaining: number;
  resetTime: number;
};

type StorefrontAuthLockoutResult = {
  locked: boolean;
  limit: number;
  remaining: number;
  resetTime: number;
};

type OtpSendLimitInput = {
  captchaToken?: string | null;
  email: string;
  merchantId: string;
};

type OtpVerifyInput = {
  email: string;
  merchantId: string;
};

const memoryCounters = new Map<string, WindowCounter>();

function parseCounter(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && /^\d+$/.test(value)) {
    return Number(value);
  }

  return 0;
}

function isCaptchaEnforced(): boolean {
  return process.env.STOREFRONT_AUTH_CAPTCHA_ENABLED === 'true';
}

function hashIdentifier(value: string): string {
  return createHash('sha256').update(value.toLowerCase().trim()).digest('hex');
}

function buildKey(prefix: string, merchantId: string, email: string): string {
  return `baci:storefront-auth:${prefix}:${merchantId}:${hashIdentifier(email)}`;
}

function incrementMemoryCounter(key: string, windowMs: number): WindowCounter {
  const now = Date.now();
  const existing = memoryCounters.get(key);
  const next =
    existing && now <= existing.resetTime
      ? { count: existing.count + 1, resetTime: existing.resetTime }
      : { count: 1, resetTime: now + windowMs };

  memoryCounters.set(key, next);
  return next;
}

async function incrementWindowCounter(
  key: string,
  windowMs: number
): Promise<WindowCounter> {
  const redis = getRedis();
  if (redis) {
    try {
      const script = redis.createScript<number | string>(`
        local count = redis.call("INCR", KEYS[1])
        if count == 1 then
          redis.call("PEXPIRE", KEYS[1], ARGV[1])
        end
        return count
      `);
      const count = parseCounter(
        await script.eval([key], [String(Math.max(1, windowMs))])
      );
      return { count, resetTime: Date.now() + windowMs };
    } catch {
      // Fall through to local memory. CI/dev without Redis still gets the same
      // route behavior, while production normally uses the durable store.
    }
  }

  return incrementMemoryCounter(key, windowMs);
}

async function getWindowCounter(
  key: string,
  windowMs: number
): Promise<WindowCounter> {
  const redis = getRedis();
  if (redis) {
    try {
      const rawCount = await redis.get<unknown>(key);
      return {
        count: parseCounter(rawCount),
        resetTime: Date.now() + windowMs,
      };
    } catch {
      // Fall through to local memory.
    }
  }

  const existing = memoryCounters.get(key);
  if (!existing || Date.now() > existing.resetTime) {
    return { count: 0, resetTime: Date.now() + windowMs };
  }

  return existing;
}

async function deleteCounter(key: string): Promise<void> {
  const redis = getRedis();
  if (redis) {
    try {
      await redis.del(key);
      return;
    } catch {
      // Keep deleting the in-memory mirror below.
    }
  }

  memoryCounters.delete(key);
}

export async function checkStorefrontOtpSendLimit({
  captchaToken,
  email,
  merchantId,
}: OtpSendLimitInput): Promise<StorefrontAuthRateLimitResult> {
  const key = buildKey('otp-send', merchantId, email);
  const counter = await incrementWindowCounter(key, SEND_WINDOW_MS);
  const captchaRequired =
    isCaptchaEnforced() &&
    !captchaToken &&
    counter.count > SEND_CAPTCHA_AFTER_ATTEMPTS;

  return {
    allowed: counter.count <= SEND_MAX_ATTEMPTS,
    captchaRequired,
    limit: SEND_MAX_ATTEMPTS,
    remaining: Math.max(0, SEND_MAX_ATTEMPTS - counter.count),
    resetTime: counter.resetTime,
  };
}

export async function checkStorefrontOtpVerifyLockout({
  email,
  merchantId,
}: OtpVerifyInput): Promise<StorefrontAuthLockoutResult> {
  const key = buildKey('otp-verify-failures', merchantId, email);
  const counter = await getWindowCounter(key, VERIFY_LOCKOUT_WINDOW_MS);

  return {
    locked: counter.count >= VERIFY_MAX_FAILURES,
    limit: VERIFY_MAX_FAILURES,
    remaining: Math.max(0, VERIFY_MAX_FAILURES - counter.count),
    resetTime: counter.resetTime,
  };
}

export async function recordStorefrontOtpVerifyFailure({
  email,
  merchantId,
}: OtpVerifyInput): Promise<StorefrontAuthLockoutResult> {
  const key = buildKey('otp-verify-failures', merchantId, email);
  const counter = await incrementWindowCounter(key, VERIFY_LOCKOUT_WINDOW_MS);

  return {
    locked: counter.count >= VERIFY_MAX_FAILURES,
    limit: VERIFY_MAX_FAILURES,
    remaining: Math.max(0, VERIFY_MAX_FAILURES - counter.count),
    resetTime: counter.resetTime,
  };
}

export async function resetStorefrontOtpVerifyFailures({
  email,
  merchantId,
}: OtpVerifyInput): Promise<void> {
  await deleteCounter(buildKey('otp-verify-failures', merchantId, email));
}

export function __resetStorefrontAuthAbuseForTesting(): void {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      '__resetStorefrontAuthAbuseForTesting should only run in tests'
    );
  }
  memoryCounters.clear();
}
