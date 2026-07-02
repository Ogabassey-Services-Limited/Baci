import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchInternalStatusJson } from './internal-status-preflight';

const CONTEXT = {
  check: 'pdp-slug-membership',
  identifier: 'ogabassey.com',
  slug: 'iphone-15',
} as const;

const BASE_URL = new URL(
  'https://usebaci.com/api/internal/slug-set/ogabassey.com?slug=iphone-15'
);

interface FakeResponseInit {
  ok?: boolean;
  status?: number;
  type?: ResponseType;
  contentType?: string | null;
  json?: () => Promise<unknown>;
}

function fakeResponse(init: FakeResponseInit): Response {
  const headers = new Headers();
  if (init.contentType != null) {
    headers.set('content-type', init.contentType);
  }
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    type: init.type ?? 'default',
    headers,
    json: init.json ?? (() => Promise.resolve({})),
  } as unknown as Response;
}

function callHelper(fetchImpl: ReturnType<typeof vi.fn>) {
  return fetchInternalStatusJson({
    url: BASE_URL,
    secret: 'internal-secret',
    timeoutMs: 800,
    fetchImpl: fetchImpl as unknown as typeof fetch,
    context: CONTEXT,
  });
}

describe('fetchInternalStatusJson', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it('returns the parsed JSON body and does not warn on a 200 application/json response', async () => {
    // Arrange
    const body = { hasError: false, present: false };
    const fetchImpl = vi.fn().mockResolvedValue(
      fakeResponse({
        ok: true,
        status: 200,
        contentType: 'application/json; charset=utf-8',
        json: () => Promise.resolve(body),
      })
    );

    // Act
    const result = await callHelper(fetchImpl);

    // Assert
    expect(result).toEqual({ kind: 'json', body });
    expect(warnSpy).not.toHaveBeenCalled();
    const [, init] = fetchImpl.mock.calls[0];
    expect((init as RequestInit).redirect).toBe('manual');
    expect((init as RequestInit).headers).toEqual({
      Authorization: 'Bearer internal-secret',
    });
  });

  it('fails open with reason "redirect" on a 302 SSO wall (never follows the login redirect)', async () => {
    // Arrange — Vercel Deployment Protection answers with a 302 to the SSO API.
    const fetchImpl = vi.fn().mockResolvedValue(
      fakeResponse({
        ok: false,
        status: 302,
        contentType: null,
      })
    );

    // Act
    const result = await callHelper(fetchImpl);

    // Assert
    expect(result).toEqual({ kind: 'fail-open', reason: 'redirect' });
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      '[internal-status-preflight] fail-open',
      {
        check: CONTEXT.check,
        identifier: CONTEXT.identifier,
        slug: CONTEXT.slug,
        reason: 'redirect',
      }
    );
  });

  it('fails open with reason "redirect" for an opaqueredirect filtered response', async () => {
    // Arrange
    const fetchImpl = vi.fn().mockResolvedValue(
      fakeResponse({
        ok: false,
        status: 0,
        type: 'opaqueredirect',
        contentType: null,
      })
    );

    // Act
    const result = await callHelper(fetchImpl);

    // Assert
    expect(result).toEqual({ kind: 'fail-open', reason: 'redirect' });
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('fails open with reason "non-json-content-type" for a 200 text/html login page', async () => {
    // Arrange — the SSO login page returns HTTP 200 text/html; it must never be
    // treated as a valid status verdict.
    const fetchImpl = vi.fn().mockResolvedValue(
      fakeResponse({
        ok: true,
        status: 200,
        contentType: 'text/html; charset=utf-8',
        json: () => Promise.reject(new Error('unexpected html parse')),
      })
    );

    // Act
    const result = await callHelper(fetchImpl);

    // Assert
    expect(result).toEqual({
      kind: 'fail-open',
      reason: 'non-json-content-type',
    });
    expect(warnSpy).toHaveBeenCalledWith(
      '[internal-status-preflight] fail-open',
      {
        check: CONTEXT.check,
        identifier: CONTEXT.identifier,
        slug: CONTEXT.slug,
        reason: 'non-json-content-type',
      }
    );
  });

  it('fails open with reason "http-<status>" on a non-ok response', async () => {
    // Arrange
    const fetchImpl = vi.fn().mockResolvedValue(
      fakeResponse({
        ok: false,
        status: 401,
        contentType: 'application/json',
      })
    );

    // Act
    const result = await callHelper(fetchImpl);

    // Assert
    expect(result).toEqual({ kind: 'fail-open', reason: 'http-401' });
    expect(warnSpy).toHaveBeenCalledWith(
      '[internal-status-preflight] fail-open',
      {
        check: CONTEXT.check,
        identifier: CONTEXT.identifier,
        slug: CONTEXT.slug,
        reason: 'http-401',
      }
    );
  });

  it('fails open with reason "parse" when the JSON body cannot be read', async () => {
    // Arrange
    const fetchImpl = vi.fn().mockResolvedValue(
      fakeResponse({
        ok: true,
        status: 200,
        contentType: 'application/json',
        json: () => Promise.reject(new SyntaxError('Unexpected token')),
      })
    );

    // Act
    const result = await callHelper(fetchImpl);

    // Assert
    expect(result).toEqual({ kind: 'fail-open', reason: 'parse' });
    expect(warnSpy).toHaveBeenCalledWith(
      '[internal-status-preflight] fail-open',
      {
        check: CONTEXT.check,
        identifier: CONTEXT.identifier,
        slug: CONTEXT.slug,
        reason: 'parse',
      }
    );
  });

  it('fails open with reason "timeout" when the fetch is aborted', async () => {
    // Arrange
    const fetchImpl = vi
      .fn()
      .mockRejectedValue(
        new DOMException('The operation timed out', 'AbortError')
      );

    // Act
    const result = await callHelper(fetchImpl);

    // Assert
    expect(result).toEqual({ kind: 'fail-open', reason: 'timeout' });
    expect(warnSpy).toHaveBeenCalledWith(
      '[internal-status-preflight] fail-open',
      {
        check: CONTEXT.check,
        identifier: CONTEXT.identifier,
        slug: CONTEXT.slug,
        reason: 'timeout',
      }
    );
  });

  it('fails open with reason "error" on a generic transport failure', async () => {
    // Arrange
    const fetchImpl = vi.fn().mockRejectedValue(new Error('ECONNRESET'));

    // Act
    const result = await callHelper(fetchImpl);

    // Assert
    expect(result).toEqual({ kind: 'fail-open', reason: 'error' });
    expect(warnSpy).toHaveBeenCalledWith(
      '[internal-status-preflight] fail-open',
      {
        check: CONTEXT.check,
        identifier: CONTEXT.identifier,
        slug: CONTEXT.slug,
        reason: 'error',
      }
    );
  });
});
