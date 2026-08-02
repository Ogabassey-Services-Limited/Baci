import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockGetSession = jest.fn<() => Promise<unknown>>();
const mockGetUser = jest.fn<(token?: string) => Promise<unknown>>();

jest.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: mockGetSession, getUser: mockGetUser } },
}));

jest.mock('@/lib/logger', () => ({
  createLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

// Load the module under test via require (not a hoisted static import) so the
// jest.mock factories above capture the initialized mock fns — a static import
// is hoisted above the const declarations and would bind `undefined`. Matches
// the require() pattern in quiz.test.ts.
const { getQuizAuthHeaders } =
  require('./quiz-auth-headers') as typeof import('./quiz-auth-headers');
const { QuizServiceError } =
  require('./quiz-types') as typeof import('./quiz-types');

const withSession = (token: string) => ({
  data: { session: { access_token: token } },
  error: null,
});
const withoutSession = { data: { session: null }, error: null };
const withUser = (id: string) => ({ data: { user: { id } }, error: null });

describe('getQuizAuthHeaders', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns bearer headers and the validated user id from a single session read', async () => {
    mockGetSession.mockResolvedValue(withSession('tok-1'));
    mockGetUser.mockResolvedValue(withUser('user-1'));

    await expect(getQuizAuthHeaders()).resolves.toEqual({
      headers: { Authorization: 'Bearer tok-1' },
      userId: 'user-1',
    });
    // The user id is validated against the SAME token the header carries.
    expect(mockGetUser).toHaveBeenCalledWith('tok-1');
  });

  it('retries once when the session has not hydrated yet, then succeeds', async () => {
    mockGetSession
      .mockResolvedValueOnce(withoutSession) // cold start: no token yet
      .mockResolvedValueOnce(withSession('tok-2')); // hydrated on retry
    mockGetUser.mockResolvedValue(withUser('user-2'));

    await expect(getQuizAuthHeaders()).resolves.toMatchObject({
      userId: 'user-2',
    });
    expect(mockGetSession).toHaveBeenCalledTimes(2);
  });

  it('throws QUIZ_AUTH_REQUIRED when no session appears after the retry', async () => {
    mockGetSession.mockResolvedValue(withoutSession);

    await expect(getQuizAuthHeaders()).rejects.toMatchObject({
      code: 'QUIZ_AUTH_REQUIRED',
      status: 401,
    });
    expect(mockGetSession).toHaveBeenCalledTimes(2);
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it('retries a transient getSession error, then succeeds', async () => {
    mockGetSession
      .mockResolvedValueOnce({
        data: { session: null },
        error: { message: 'network blip' },
      })
      .mockResolvedValueOnce(withSession('tok-3'));
    mockGetUser.mockResolvedValue(withUser('user-3'));

    await expect(getQuizAuthHeaders()).resolves.toMatchObject({
      userId: 'user-3',
    });
    expect(mockGetSession).toHaveBeenCalledTimes(2);
  });

  it('does not retry a definitive auth error (401) and throws', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: { message: 'jwt expired', status: 401 },
    });

    await expect(getQuizAuthHeaders()).rejects.toBeInstanceOf(QuizServiceError);
    // A definitive error (401 / expired jwt) must fail fast, not burn a retry.
    expect(mockGetSession).toHaveBeenCalledTimes(1);
  });

  it('retries a transient getUser failure, then throws after the attempt cap', async () => {
    mockGetSession.mockResolvedValue(withSession('tok-x'));
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'temporary' },
    });

    await expect(getQuizAuthHeaders()).rejects.toMatchObject({
      code: 'QUIZ_AUTH_REQUIRED',
    });
    expect(mockGetUser).toHaveBeenCalledTimes(2);
  });
});
