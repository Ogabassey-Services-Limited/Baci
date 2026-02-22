import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockHasPermission = vi.fn();
vi.mock('@/lib/api-auth', () => ({
  hasPermission: (...args: unknown[]) => mockHasPermission(...args),
}));

const mockCheckCsrfProtection = vi.fn();
vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: (...args: unknown[]) => mockCheckCsrfProtection(...args),
}));

const mockGetMerchantForApiRequest = vi.fn();
const mockToUserAccess = vi.fn();
vi.mock('@/lib/get-merchant-for-api-request', () => ({
  getMerchantForApiRequest: (...args: unknown[]) =>
    mockGetMerchantForApiRequest(...args),
  toUserAccess: (...args: unknown[]) => mockToUserAccess(...args),
}));

const mockNormalizeHeroSlidesForStorage = vi.fn();
vi.mock('@/lib/hero-carousel-config', () => ({
  normalizeHeroSlidesForStorage: (...args: unknown[]) =>
    mockNormalizeHeroSlidesForStorage(...args),
}));

const mockLoggerError = vi.fn();
vi.mock('@/lib/logger', () => ({
  logger: {
    error: (...args: unknown[]) => mockLoggerError(...args),
  },
}));

const mockGetAuthenticatedUser = vi.fn();
vi.mock('@/lib/supabase/mobile-auth', () => ({
  getAuthenticatedUser: (...args: unknown[]) =>
    mockGetAuthenticatedUser(...args),
}));

function makeRequest(method: 'GET' | 'PUT', body?: Record<string, unknown>) {
  return new NextRequest('http://localhost:3000/api/merchant/hero-carousel', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function getRouteHandlers() {
  const route = await import('./route');
  return {
    GET: route.GET as NonNullable<typeof route.GET>,
    PUT: route.PUT as NonNullable<typeof route.PUT>,
  };
}

async function callGet(request: NextRequest): Promise<Response> {
  const { GET } = await getRouteHandlers();
  const response = await GET(request);
  if (!response) {
    throw new Error('GET handler returned no response');
  }
  return response;
}

async function callPut(request: NextRequest): Promise<Response> {
  const { PUT } = await getRouteHandlers();
  const response = await PUT(request);
  if (!response) {
    throw new Error('PUT handler returned no response');
  }
  return response;
}

let selectQueue: Array<{ data: unknown; error: unknown }> = [];
let updateResult: { error: unknown } = { error: null };

function createMockSupabase() {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => {
            const nextResult = selectQueue.shift();
            return (
              nextResult ?? {
                data: null,
                error: { message: 'Missing mocked select result' },
              }
            );
          }),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(async () => updateResult),
      })),
    })),
  };
}

describe('GET /api/merchant/hero-carousel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectQueue = [];
    updateResult = { error: null };

    const supabase = createMockSupabase();
    mockGetAuthenticatedUser.mockResolvedValue({
      user: { id: 'user-1' },
      supabase,
    });
    mockGetMerchantForApiRequest.mockResolvedValue({
      merchantId: 'merchant-1',
      role: 'owner',
    });
    mockToUserAccess.mockReturnValue({
      merchantId: 'merchant-1',
      role: 'owner',
    });
    mockHasPermission.mockReturnValue(true);
    mockNormalizeHeroSlidesForStorage.mockImplementation((slides) => slides);
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(null);

    const response = await callGet(makeRequest('GET'));
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error).toBe('Unauthorized');
  });

  it('returns 403 when user lacks carousel view permission', async () => {
    mockHasPermission.mockReturnValue(false);

    const response = await callGet(makeRequest('GET'));
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.error).toBe('Forbidden');
  });

  it('returns 404 when merchant context cannot be resolved', async () => {
    mockGetMerchantForApiRequest.mockResolvedValue(null);

    const response = await callGet(makeRequest('GET'));
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload.error).toBe('Merchant not found');
  });

  it('returns normalized slides with source and drift flag', async () => {
    selectQueue.push({
      data: {
        id: 'merchant-1',
        mobile_hero_slides: [{ headline: 'raw' }],
      },
      error: null,
    });
    mockNormalizeHeroSlidesForStorage.mockReturnValue([
      {
        id: 'slide-1',
        imageUrl: 'https://cdn.example.com/hero.png',
        headline: 'Normalized',
        description: '',
        cta: 'Shop Now',
        link: '/category/all',
      },
    ]);

    const response = await callGet(makeRequest('GET'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mockNormalizeHeroSlidesForStorage).toHaveBeenCalledWith([
      { headline: 'raw' },
    ]);
    expect(payload).toEqual({
      slides: [
        {
          id: 'slide-1',
          imageUrl: 'https://cdn.example.com/hero.png',
          headline: 'Normalized',
          description: '',
          cta: 'Shop Now',
          link: '/category/all',
        },
      ],
      source: 'mobile_hero_slides',
      driftDetected: false,
    });
  });

  it('returns 404 when merchant row is missing', async () => {
    selectQueue.push({
      data: null,
      error: { message: 'not found' },
    });

    const response = await callGet(makeRequest('GET'));
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload.error).toBe('Merchant not found');
  });

  it('returns 500 and logs on unexpected errors', async () => {
    mockGetAuthenticatedUser.mockRejectedValue(new Error('boom'));

    const response = await callGet(makeRequest('GET'));
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.error).toBe('Failed to load hero carousel settings');
    expect(mockLoggerError).toHaveBeenCalled();
  });
});

describe('PUT /api/merchant/hero-carousel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectQueue = [];
    updateResult = { error: null };

    const supabase = createMockSupabase();
    mockGetAuthenticatedUser.mockResolvedValue({
      user: { id: 'user-1' },
      supabase,
    });
    mockGetMerchantForApiRequest.mockResolvedValue({
      merchantId: 'merchant-1',
      role: 'owner',
    });
    mockToUserAccess.mockReturnValue({
      merchantId: 'merchant-1',
      role: 'owner',
    });
    mockHasPermission.mockReturnValue(true);
    mockCheckCsrfProtection.mockResolvedValue({ valid: true });
    mockNormalizeHeroSlidesForStorage.mockImplementation((slides) => slides);
  });

  it('returns 403 when CSRF validation fails', async () => {
    mockCheckCsrfProtection.mockResolvedValue({
      valid: false,
      response: new Response(
        JSON.stringify({ error: 'CSRF validation failed' }),
        { status: 403 }
      ),
    });

    const response = await callPut(makeRequest('PUT', { slides: [] }));

    expect(response.status).toBe(403);
  });

  it('returns 400 on invalid payload', async () => {
    const response = await callPut(
      makeRequest('PUT', { slides: 'not-an-array' })
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe('Invalid input');
  });

  it('returns 403 when user lacks edit permission', async () => {
    mockHasPermission.mockReturnValue(false);

    const response = await callPut(makeRequest('PUT', { slides: [] }));
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.error).toBe('Forbidden');
  });

  it('updates merchant mobile slides successfully', async () => {
    selectQueue.push({ data: { id: 'merchant-1' }, error: null });

    const response = await callPut(
      makeRequest('PUT', {
        slides: [{ headline: 'Fresh' }],
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      success: true,
      slides: [
        {
          imageUrl: '',
          headline: 'Fresh',
          description: '',
          cta: '',
          link: '/category/all',
        },
      ],
    });
  });

  it('returns 404 when merchant row is missing on update', async () => {
    selectQueue.push({
      data: null,
      error: { message: 'not found' },
    });

    const response = await callPut(makeRequest('PUT', { slides: [] }));
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload.error).toBe('Merchant not found');
  });

  it('returns generic 500 and logs on merchant update error', async () => {
    selectQueue.push({ data: { id: 'merchant-1' }, error: null });
    updateResult = { error: { message: 'db exploded' } };

    const response = await callPut(makeRequest('PUT', { slides: [] }));
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.error).toBe('Failed to update merchant hero slides');
    expect(mockLoggerError).toHaveBeenCalled();
  });
});
