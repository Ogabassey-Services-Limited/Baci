import { NextRequest, NextResponse } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkCsrfProtection } from '@/lib/csrf';
import {
  parseJsonBody,
  rejectQuizIdentityMismatch,
  requireQuizCsrf,
} from './route-helpers';

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: vi.fn(),
}));

async function readJson(response: Response) {
  return JSON.parse(await response.text());
}

describe('quiz route-helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('parseJsonBody', () => {
    it('parses a valid JSON body', async () => {
      const request = new Request('https://x.test', {
        body: JSON.stringify({ a: 1 }),
        method: 'POST',
      });

      const result = await parseJsonBody(request);

      expect(result.response).toBeNull();
      expect(result.body).toEqual({ a: 1 });
    });

    it('returns a 400 response on invalid JSON', async () => {
      const request = new Request('https://x.test', {
        body: '{not-json',
        method: 'POST',
      });

      const result = await parseJsonBody(request);

      expect(result.body).toBeNull();
      expect(result.response?.status).toBe(400);
      expect(await readJson(result.response as Response)).toEqual({
        error: 'Invalid JSON body',
      });
    });
  });

  describe('requireQuizCsrf', () => {
    it('returns null when csrf validation passes', async () => {
      const request = new NextRequest('http://localhost/api/quiz/test', {
        method: 'POST',
      });
      vi.mocked(checkCsrfProtection).mockResolvedValue({ valid: true });

      await expect(requireQuizCsrf(request)).resolves.toBeNull();
      expect(checkCsrfProtection).toHaveBeenCalledWith(request);
    });

    it('returns the csrf failure response when validation fails', async () => {
      const request = new NextRequest('http://localhost/api/quiz/test', {
        method: 'POST',
      });
      const csrfResponse = NextResponse.json(
        { error: 'Invalid CSRF token' },
        { status: 403 }
      );
      vi.mocked(checkCsrfProtection).mockResolvedValue({
        response: csrfResponse,
        valid: false,
      });

      const response = await requireQuizCsrf(request);

      expect(response).toBe(csrfResponse);
      expect(response?.status).toBe(403);
    });
  });
});

describe('rejectQuizIdentityMismatch', () => {
  it('returns null when no expected user is pinned', () => {
    expect(rejectQuizIdentityMismatch(undefined, 'user-1')).toBeNull();
  });

  it('returns null when the expected user matches the session', () => {
    expect(rejectQuizIdentityMismatch('user-1', 'user-1')).toBeNull();
  });

  it('returns a 409 session_changed response on a mismatch', async () => {
    const response = rejectQuizIdentityMismatch('user-2', 'user-1');
    expect(response).not.toBeNull();
    expect(response?.status).toBe(409);
    expect(await response?.json()).toMatchObject({ code: 'session_changed' });
  });
});
