import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';
import {
  readQuizDeviceFingerprint,
  rejectUnsupportedQuizContract,
  requireQuizV2Contract,
  requireQuizV2Runtime,
  requiresQuizV2,
} from './quiz-v2-contract';

function request(headers?: HeadersInit) {
  return new NextRequest('https://shop.test/api/quiz/events', { headers });
}

describe('quiz v2 route contract', () => {
  it('distinguishes legacy, supported, and unsupported contracts', () => {
    expect(requiresQuizV2(request())).toBe(false);
    expect(requireQuizV2Contract(request())?.status).toBe(426);
    expect(rejectUnsupportedQuizContract(request())).toBeNull();

    const supported = request({ 'X-Baci-Quiz-Contract': '2' });
    expect(requiresQuizV2(supported)).toBe(true);
    expect(requireQuizV2Contract(supported)).toBeNull();

    expect(
      rejectUnsupportedQuizContract(request({ 'X-Baci-Quiz-Contract': '3' }))
        ?.status
    ).toBe(426);
  });

  it('fails closed until the database runtime sentinel is exactly 2', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: 1, error: null });
    expect((await requireQuizV2Runtime({ rpc } as never))?.status).toBe(503);

    rpc.mockResolvedValue({ data: 2, error: null });
    expect(await requireQuizV2Runtime({ rpc } as never)).toBeNull();
  });

  it('reads only a valid fingerprint header', () => {
    const fingerprint = 'a'.repeat(64);
    expect(
      readQuizDeviceFingerprint(
        request({ 'X-Baci-Quiz-Device-Fingerprint': fingerprint })
      )
    ).toBe(fingerprint);
    expect(readQuizDeviceFingerprint(request())).toBeNull();
    expect(
      readQuizDeviceFingerprint(
        request({ 'X-Baci-Quiz-Device-Fingerprint': 'not-a-hash' })
      )
    ).toBeNull();
  });
});
