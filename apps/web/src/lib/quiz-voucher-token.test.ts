import { createHash, createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  createQuizVoucherToken,
  verifyQuizVoucherToken,
} from '@/lib/quiz-voucher-token';

const voucherPayload = {
  awardId: '11111111-1111-4111-8111-111111111111',
  condition: 'new',
  expiresAt: '2026-05-22T12:00:00.000Z',
  productId: '22222222-2222-4222-8222-222222222222',
  userId: '33333333-3333-4333-8333-333333333333',
  variantId: '44444444-4444-4444-8444-444444444444',
};
const voucherSecret = createHash('sha256')
  .update(voucherPayload.awardId)
  .digest('hex');

function signVoucherBody(body: string): string {
  return createHmac('sha256', voucherSecret)
    .update(`qv1.${body}`)
    .digest('base64url');
}

describe('quiz voucher token', () => {
  it('creates and verifies a signed voucher token under the order schema limit', () => {
    const token = createQuizVoucherToken({
      payload: voucherPayload,
      secret: voucherSecret,
    });

    expect(token).toMatch(/^qv1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(token.length).toBeLessThanOrEqual(512);
    expect(
      verifyQuizVoucherToken(token, {
        now: '2026-05-22T11:59:59.000Z',
        secret: voucherSecret,
      })
    ).toEqual({
      ok: true,
      payload: voucherPayload,
    });
  });

  it('rejects tampered tokens without leaking which field changed', () => {
    const token = createQuizVoucherToken({
      payload: voucherPayload,
      secret: voucherSecret,
    });
    const [version, body, signature] = token.split('.');
    const tamperedBody = body.replace(/[A-Za-z0-9_-]$/, (char) =>
      char === 'A' ? 'B' : 'A'
    );

    expect(
      verifyQuizVoucherToken(`${version}.${tamperedBody}.${signature}`, {
        now: '2026-05-22T11:59:59.000Z',
        secret: voucherSecret,
      })
    ).toEqual({
      error: 'invalid_quiz_voucher_token',
      ok: false,
    });
  });

  it.each([
    'qv2.body.sig',
    'qv1.body',
    'qv1.a.b.c',
  ])('rejects malformed token structure: %s', (token) => {
    expect(
      verifyQuizVoucherToken(token, {
        now: '2026-05-22T11:59:59.000Z',
        secret: voucherSecret,
      })
    ).toEqual({
      error: 'invalid_quiz_voucher_token',
      ok: false,
    });
  });

  it('rejects a signed token body that is not valid JSON', () => {
    const body = Buffer.from('not-json', 'utf8').toString('base64url');
    const token = `qv1.${body}.${signVoucherBody(body)}`;

    expect(
      verifyQuizVoucherToken(token, {
        now: '2026-05-22T11:59:59.000Z',
        secret: voucherSecret,
      })
    ).toEqual({
      error: 'invalid_quiz_voucher_token',
      ok: false,
    });
  });

  it('accepts a token at the exact expiration boundary', () => {
    const token = createQuizVoucherToken({
      payload: voucherPayload,
      secret: voucherSecret,
    });

    expect(
      verifyQuizVoucherToken(token, {
        now: voucherPayload.expiresAt,
        secret: voucherSecret,
      })
    ).toEqual({
      ok: true,
      payload: voucherPayload,
    });
  });

  it('rejects expired tokens', () => {
    const token = createQuizVoucherToken({
      payload: voucherPayload,
      secret: voucherSecret,
    });

    expect(
      verifyQuizVoucherToken(token, {
        now: '2026-05-22T12:00:01.000Z',
        secret: voucherSecret,
      })
    ).toEqual({
      error: 'expired_quiz_voucher_token',
      ok: false,
    });
  });

  it('fails closed when the signing secret is missing', () => {
    expect(() =>
      createQuizVoucherToken({
        payload: voucherPayload,
        secret: '  ',
      })
    ).toThrow('missing_quiz_voucher_secret');

    expect(
      verifyQuizVoucherToken('qv1.invalid.invalid', {
        now: '2026-05-22T11:59:59.000Z',
        secret: '',
      })
    ).toEqual({
      error: 'missing_quiz_voucher_secret',
      ok: false,
    });
  });
});
