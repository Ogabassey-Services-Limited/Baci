import { NextRequest, NextResponse } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authenticateApiRequest } from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import { logger } from '@/lib/logger';
import { createClient } from '@/lib/supabase/server';
import {
  invalidInputResponse,
  parseJsonBody,
  requireQuizCsrf,
  requireQuizUser,
  rpcErrorResponse,
} from './route-helpers';

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: vi.fn(),
}));

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

const ORIGINAL_ENV = process.env;
const USER_ID = 'user-1';

function mockSupabase({
  authError = null,
  user = { id: USER_ID },
  selectResult = { data: null, error: null },
}: {
  authError?: unknown;
  user?: { id: string } | null;
  selectResult?: { data: unknown; error: unknown };
} = {}) {
  const queryBuilder = {
    eq: vi.fn(() => queryBuilder),
    maybeSingle: vi.fn().mockResolvedValue(selectResult),
    select: vi.fn(() => queryBuilder),
    single: vi.fn().mockResolvedValue(selectResult),
  };
  const supabase = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error: authError }),
    },
    from: vi.fn(() => queryBuilder),
  };
  vi.mocked(createClient).mockResolvedValue(supabase as never);
  return { queryBuilder, supabase };
}

async function readJson(response: Response) {
  return JSON.parse(await response.text());
}

describe('quiz route-helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    vi.restoreAllMocks();
  });

  describe('requireQuizUser', () => {
    it('returns the user when authenticated', async () => {
      mockSupabase({ user: { id: USER_ID } });

      const result = await requireQuizUser();

      expect(result.response).toBeNull();
      expect(result.user).toEqual({ id: USER_ID });
    });

    it('returns a 401 response when unauthenticated', async () => {
      mockSupabase({ user: null });

      const result = await requireQuizUser();

      expect(result.user).toBeNull();
      expect(result.supabase).toBeNull();
      expect(result.response?.status).toBe(401);
      expect(await readJson(result.response as Response)).toEqual({
        error: 'Unauthorized',
      });
    });

    it('logs only safe auth lookup error fields', async () => {
      mockSupabase({
        authError: {
          code: 'auth_lookup_failed',
          message: 'lookup failed',
          status: 500,
          token: 'secret-token',
        },
        user: null,
      });

      const result = await requireQuizUser();

      expect(result.response?.status).toBe(401);
      expect(logger.error).toHaveBeenCalledWith({
        errorCode: 'auth_lookup_failed',
        errorMessage: 'lookup failed',
        errorStatus: 500,
        message: 'Quiz auth lookup failed',
      });
      expect(JSON.stringify(vi.mocked(logger.error).mock.calls)).not.toContain(
        'secret-token'
      );
    });

    it('returns the bearer-authenticated user and Supabase client', async () => {
      const request = new NextRequest('http://localhost/api/quiz/events', {
        headers: { Authorization: 'Bearer token-123' },
      });
      const supabase = { from: vi.fn() };
      vi.mocked(authenticateApiRequest).mockResolvedValue({
        error: null,
        supabase: supabase as never,
        user: { id: USER_ID } as never,
      });

      const result = await requireQuizUser(request);

      expect(result.response).toBeNull();
      expect(result.supabase).toBe(supabase);
      expect(result.user).toEqual({ id: USER_ID });
      expect(authenticateApiRequest).toHaveBeenCalledWith(request);
      expect(createClient).not.toHaveBeenCalled();
    });

    it('returns a 401 response when bearer authentication fails', async () => {
      const request = new NextRequest('http://localhost/api/quiz/events', {
        headers: { Authorization: 'Bearer token-123' },
      });
      vi.mocked(authenticateApiRequest).mockResolvedValue({
        error: 'Unauthorized',
        supabase: null,
        user: null,
      });

      const result = await requireQuizUser(request);

      expect(result.user).toBeNull();
      expect(result.supabase).toBeNull();
      expect(result.response?.status).toBe(401);
      expect(await readJson(result.response as Response)).toEqual({
        error: 'Unauthorized',
      });
      expect(createClient).not.toHaveBeenCalled();
    });
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

  describe('static response helpers', () => {
    it('invalidInputResponse returns 400 with details', async () => {
      const response = invalidInputResponse({ field: ['required'] });

      expect(response.status).toBe(400);
      expect(await readJson(response)).toEqual({
        details: { field: ['required'] },
        error: 'Invalid input',
      });
    });

    it('rpcErrorResponse returns 500', async () => {
      const response = rpcErrorResponse();

      expect(response.status).toBe(500);
      expect(await readJson(response)).toEqual({
        error: 'Quiz request failed',
      });
    });
  });
});
