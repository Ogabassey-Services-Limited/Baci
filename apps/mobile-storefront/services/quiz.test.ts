import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

const mockFetch = jest.fn<typeof fetch>();
type MockAuthError = { message?: string; status?: number } | null;
type MockSessionResult = {
  data: { session: { access_token: string } | null };
  error?: MockAuthError;
};
type MockUserResult = {
  data: { user: { id: string } | null };
  error?: MockAuthError;
};

const mockGetSession = jest.fn<() => Promise<MockSessionResult>>();
const mockGetUser = jest.fn<(token?: string) => Promise<MockUserResult>>();

global.fetch = mockFetch;

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      getUser: mockGetUser,
    },
  },
}));

const { fetchQuizEvents, startQuizAttempt } =
  require('./quiz') as typeof import('./quiz');

describe('quiz service', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockGetSession.mockReset();
    mockGetUser.mockReset();
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'token-123' } },
    });
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('maps event list responses into mobile quiz events', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          events: [
            {
              id: 'event-1',
              title: 'Win airtime',
              prizeName: 'N50,000 airtime',
              startsAt: '2026-05-20T10:00:00.000Z',
              endsAt: '2026-05-20T10:10:00.000Z',
              status: 'open',
              questionCount: 5,
            },
          ],
        }),
        { status: 200 }
      )
    );

    await expect(
      fetchQuizEvents({ baseUrl: 'https://example.com' })
    ).resolves.toEqual([
      {
        id: 'event-1',
        title: 'Win airtime',
        prizeName: 'N50,000 airtime',
        startsAt: '2026-05-20T10:00:00.000Z',
        endsAt: '2026-05-20T10:10:00.000Z',
        status: 'open',
        questionCount: 5,
      },
    ]);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://example.com/api/quiz/events',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer token-123',
        }),
        method: 'GET',
      })
    );
  });

  it('throws mapped quiz errors from API error responses', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ error: 'Quiz closed', code: 'QUIZ_CLOSED' }),
        {
          status: 409,
        }
      )
    );

    await expect(
      fetchQuizEvents({ baseUrl: 'https://example.com' })
    ).rejects.toMatchObject({
      code: 'QUIZ_CLOSED',
      message: 'Quiz closed',
      status: 409,
    });
  });

  it('fails closed before requests when the mobile bearer session is missing', async () => {
    mockGetSession.mockResolvedValueOnce({ data: { session: null } });

    await expect(
      fetchQuizEvents({ baseUrl: 'https://example.com' })
    ).rejects.toMatchObject({
      code: 'QUIZ_AUTH_REQUIRED',
      message: 'Quiz authentication required',
      status: 401,
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('retries transient mobile bearer session read errors once', async () => {
    jest.useFakeTimers();
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockGetSession
      .mockResolvedValueOnce({
        data: { session: null },
        error: { message: 'network timeout' },
      })
      .mockResolvedValueOnce({
        data: { session: { access_token: 'token-123' } },
        error: null,
      });
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ events: [] }), { status: 200 })
    );

    const resultPromise = fetchQuizEvents({ baseUrl: 'https://example.com' });
    await jest.advanceTimersByTimeAsync(300);

    await expect(resultPromise).resolves.toEqual([]);
    expect(mockGetSession).toHaveBeenCalledTimes(2);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      'Unable to read quiz auth session',
      expect.objectContaining({ attempt: 1, message: 'network timeout' })
    );
  });

  it('fails closed before requests when reading the mobile bearer session has a definitive auth error', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockGetSession.mockResolvedValueOnce({
      data: { session: null },
      error: { message: 'invalid refresh token', status: 401 },
    });

    await expect(
      fetchQuizEvents({ baseUrl: 'https://example.com' })
    ).rejects.toMatchObject({
      code: 'QUIZ_AUTH_REQUIRED',
      message: 'Quiz authentication required',
      status: 401,
    });
    expect(mockGetSession).toHaveBeenCalledTimes(1);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('fails closed when the mobile bearer token cannot be validated', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockGetUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'token invalid' },
    });

    await expect(
      fetchQuizEvents({ baseUrl: 'https://example.com' })
    ).rejects.toMatchObject({
      code: 'QUIZ_AUTH_REQUIRED',
      message: 'Quiz authentication required',
      status: 401,
    });
    expect(mockGetUser).toHaveBeenCalledTimes(1);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('retries transient mobile bearer token validation errors once', async () => {
    jest.useFakeTimers();
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockGetUser
      .mockResolvedValueOnce({
        data: { user: null },
        error: { message: 'network timeout' },
      })
      .mockResolvedValueOnce({
        data: { user: { id: 'user-1' } },
        error: null,
      });
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ events: [] }), { status: 200 })
    );

    const resultPromise = fetchQuizEvents({ baseUrl: 'https://example.com' });
    await jest.advanceTimersByTimeAsync(300);

    await expect(resultPromise).resolves.toEqual([]);
    expect(mockGetSession).toHaveBeenCalledTimes(2);
    expect(mockGetUser).toHaveBeenCalledTimes(2);
    expect(warnSpy).toHaveBeenCalledWith(
      'Unable to validate quiz auth session',
      expect.objectContaining({ attempt: 1, message: 'network timeout' })
    );
  });

  it('propagates network-level fetch failures', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network down'));

    await expect(
      fetchQuizEvents({ baseUrl: 'https://example.com' })
    ).rejects.toThrow('network down');
  });

  it('throws when a successful API response does not match the quiz contract', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ attemptId: 123 }), { status: 200 })
    );

    await expect(
      startQuizAttempt({
        baseUrl: 'https://example.com',
        eventId: 'event-1',
        integrityTier: 'basic',
      })
    ).rejects.toMatchObject({
      code: 'QUIZ_INVALID_RESPONSE',
      status: 502,
    });
  });

  it('logs only safe metadata when API JSON parsing fails', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockFetch.mockResolvedValueOnce(
      new Response('session-token=secret', { status: 200 })
    );

    await expect(
      fetchQuizEvents({ baseUrl: 'https://example.com' })
    ).rejects.toMatchObject({
      code: 'QUIZ_INVALID_RESPONSE',
      status: 502,
    });

    expect(warnSpy).toHaveBeenCalledWith(
      'Unable to parse quiz API JSON response',
      expect.objectContaining({
        errorName: expect.any(String),
        status: 200,
      })
    );
    const loggedMetadata = warnSpy.mock.calls[0]?.[1];
    const loggedMetadataKeys =
      loggedMetadata && typeof loggedMetadata === 'object'
        ? Object.keys(loggedMetadata)
        : [];
    expect(
      loggedMetadataKeys.some((key) =>
        /(body|text|response|data|content)/i.test(key)
      )
    ).toBe(false);
    expect(JSON.stringify(warnSpy.mock.calls[0])).not.toContain(
      'session-token=secret'
    );

    warnSpy.mockRestore();
  });
});
