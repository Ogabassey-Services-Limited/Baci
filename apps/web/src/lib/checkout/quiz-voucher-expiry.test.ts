import { describe, expect, it } from 'vitest';
import {
  isQuizVoucherTokenExpired,
  pruneExpiredVoucherCartLines,
  readQuizVoucherExpiry,
} from './quiz-voucher-expiry';

interface TestCartLine {
  id: string;
  quantity: number;
  quizAwardId?: string;
  quizVoucherToken?: string;
}

function buildToken(payload: Record<string, unknown>): string {
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString(
    'base64url'
  );
  return `qv1.${body}.fake-signature`;
}

const NOW = Date.parse('2026-07-06T00:00:00.000Z');
const FUTURE = '2026-07-13T00:00:00.000Z';
const PAST = '2026-06-29T00:00:00.000Z';

describe('readQuizVoucherExpiry', () => {
  it('reads the expiresAt claim without verifying the signature', () => {
    const token = buildToken({ awardId: 'a', expiresAt: FUTURE });
    expect(readQuizVoucherExpiry(token)).toBe(Date.parse(FUTURE));
  });

  it('returns null for a malformed token', () => {
    expect(readQuizVoucherExpiry('not-a-token')).toBeNull();
    expect(readQuizVoucherExpiry('qv1.%%%.sig')).toBeNull();
  });

  it('returns null when the payload has no expiry', () => {
    expect(readQuizVoucherExpiry(buildToken({ awardId: 'a' }))).toBeNull();
  });
});

describe('isQuizVoucherTokenExpired', () => {
  it('is true when the expiry is in the past', () => {
    expect(
      isQuizVoucherTokenExpired(buildToken({ expiresAt: PAST }), NOW)
    ).toBe(true);
  });

  it('is false when the expiry is in the future', () => {
    expect(
      isQuizVoucherTokenExpired(buildToken({ expiresAt: FUTURE }), NOW)
    ).toBe(false);
  });

  it('fails open (false) when expiry cannot be read', () => {
    expect(isQuizVoucherTokenExpired('garbage', NOW)).toBe(false);
  });
});

describe('pruneExpiredVoucherCartLines', () => {
  it('removes only expired voucher lines and keeps everything else', () => {
    const cart: TestCartLine[] = [
      { id: 'plain', quantity: 1 },
      {
        id: 'expired-voucher',
        quantity: 1,
        quizAwardId: 'award-1',
        quizVoucherToken: buildToken({ expiresAt: PAST }),
      },
      {
        id: 'live-voucher',
        quantity: 1,
        quizAwardId: 'award-2',
        quizVoucherToken: buildToken({ expiresAt: FUTURE }),
      },
    ];

    const result = pruneExpiredVoucherCartLines(cart, NOW);

    expect(result.map((item) => item.id)).toEqual(['plain', 'live-voucher']);
  });

  it('returns the cart unchanged when there are no expired vouchers', () => {
    const cart: TestCartLine[] = [{ id: 'plain', quantity: 1 }];
    expect(pruneExpiredVoucherCartLines(cart, NOW)).toEqual(cart);
  });
});
