import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCheckCsrfProtection = vi.fn();
const mockAuthenticateApiRequest = vi.fn();
const mockGetUserAccess = vi.fn();
const mockHasPermission = vi.fn();

const mockMerchantMaybeSingle = vi.fn();
const mockQuizEventUpdateSingle = vi.fn();
const mockQuizEventSelect = vi.fn(() => ({
  single: mockQuizEventUpdateSingle,
}));
const mockQuizEventEqThird = vi.fn(() => ({ select: mockQuizEventSelect }));
const mockQuizEventEqSecond = vi.fn(() => ({ eq: mockQuizEventEqThird }));
const mockQuizEventEqFirst = vi.fn(() => ({ eq: mockQuizEventEqSecond }));
const mockQuizEventUpdate = vi.fn(() => ({ eq: mockQuizEventEqFirst }));
const mockFrom = vi.fn((table: string) => {
  if (table === 'merchants') {
    return {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({ maybeSingle: mockMerchantMaybeSingle })),
      })),
    };
  }
  if (table === 'quiz_events') {
    return { update: mockQuizEventUpdate };
  }
  return {};
});

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: (...args: unknown[]) => mockCheckCsrfProtection(...args),
}));

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: (...args: unknown[]) =>
    mockAuthenticateApiRequest(...args),
  getUserAccess: (...args: unknown[]) => mockGetUserAccess(...args),
  hasPermission: (...args: unknown[]) => mockHasPermission(...args),
}));

const { POST } = await import('./route');

const EVENT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function createRequest(body: Record<string, unknown>): NextRequest {
  return new Request('http://localhost/api/merchant/quiz/activate', {
    body: JSON.stringify({ confirmActivation: true, ...body }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  }) as unknown as NextRequest;
}

describe('POST /api/merchant/quiz/activate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckCsrfProtection.mockResolvedValue({ valid: true, response: null });
    mockAuthenticateApiRequest.mockResolvedValue({
      error: null,
      supabase: { from: mockFrom },
      user: { id: 'user-1' },
    });
    mockGetUserAccess.mockResolvedValue({
      isOwner: true,
      isStaff: false,
      merchantId: 'merchant-1',
      permissions: {},
      role: 'owner',
    });
    mockHasPermission.mockReturnValue(true);
    mockMerchantMaybeSingle.mockResolvedValue({
      data: { business_name: 'OgaBassey Gadgets', slug: 'ogabassey' },
      error: null,
    });
    mockQuizEventUpdateSingle.mockResolvedValue({
      data: {
        id: 'event-1',
        slug: 'daily-phone-quiz',
        status: 'active',
        title: 'Daily Phone Quiz',
      },
      error: null,
    });
  });

  it('opens a reviewed draft into an active event', async () => {
    const response = await POST(createRequest({ eventId: EVENT_ID }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockQuizEventUpdate).toHaveBeenCalledWith({
      ends_at: null,
      starts_at: expect.any(String),
      status: 'active',
    });
    expect(mockQuizEventEqFirst).toHaveBeenCalledWith('id', EVENT_ID);
    expect(mockQuizEventEqSecond).toHaveBeenCalledWith(
      'merchant_id',
      'merchant-1'
    );
    // Only drafts can be activated.
    expect(mockQuizEventEqThird).toHaveBeenCalledWith('status', 'draft');
    expect(body.event.status).toBe('active');
  });

  it('returns 400 when the draft to activate cannot be opened', async () => {
    mockQuizEventUpdateSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'not found' },
    });

    const response = await POST(createRequest({ eventId: EVENT_ID }));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      code: 'QUIZ_ACTIVATION_FAILED',
    });
  });

  it('returns 400 for an invalid body', async () => {
    const response = await POST(createRequest({ eventId: 'not-a-uuid' }));

    expect(response.status).toBe(400);
    expect(mockQuizEventUpdate).not.toHaveBeenCalled();
  });

  it('requires marketing edit permission', async () => {
    mockHasPermission.mockReturnValue(false);

    const response = await POST(createRequest({ eventId: EVENT_ID }));

    expect(response.status).toBe(403);
    expect(mockQuizEventUpdate).not.toHaveBeenCalled();
  });

  it('rejects requests that fail csrf validation', async () => {
    mockCheckCsrfProtection.mockResolvedValue({
      response: NextResponse.json(
        { error: 'CSRF validation failed' },
        { status: 403 }
      ),
      valid: false,
    });

    const response = await POST(createRequest({ eventId: EVENT_ID }));

    expect(response.status).toBe(403);
    expect(mockQuizEventUpdate).not.toHaveBeenCalled();
  });
});
