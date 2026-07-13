import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';

export const petrockRemediationOrderRouteHelpers = {
  errorResponse(error: string, code: string, status: number) {
    return NextResponse.json(
      { code, error, status: 'error', success: false },
      { status }
    );
  },
  hashesMatch(candidate: string, expected: string) {
    if (!/^[a-f0-9]{64}$/.test(candidate) || !/^[a-f0-9]{64}$/.test(expected)) {
      return false;
    }
    return timingSafeEqual(
      Buffer.from(candidate, 'hex'),
      Buffer.from(expected, 'hex')
    );
  },
  replayResponse(orderId: string, status: string) {
    const pending = [
      'submitting',
      'submitted',
      'in_progress',
      'submission_unknown',
    ].includes(status);
    if (pending) {
      return NextResponse.json(
        { orderId, pollAfterMs: 30_000, status, success: true },
        { status: 202 }
      );
    }
    if (['completed', 'failed', 'refunded', 'cancelled'].includes(status)) {
      return NextResponse.json({ orderId, status, success: true });
    }
    return null;
  },
};
