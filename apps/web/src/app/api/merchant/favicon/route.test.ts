import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

const mocks = vi.hoisted(() => ({
  checkCsrfProtection: vi.fn(),
  authenticateApiRequest: vi.fn(),
  getUserAccess: vi.fn(),
  hasPermission: vi.fn(),
  processFavicon: vi.fn(),
  update: vi.fn(),
  updateEq: vi.fn(),
}));

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: mocks.checkCsrfProtection,
}));

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: mocks.authenticateApiRequest,
  getUserAccess: mocks.getUserAccess,
  hasPermission: mocks.hasPermission,
}));

vi.mock('@/lib/favicon-processor', () => ({
  processFavicon: mocks.processFavicon,
}));

function buildRequest(formData?: FormData) {
  // CSRF + auth are mocked, so the route only consumes request.formData().
  // Return the FormData directly to avoid undici's multipart re-parse, which
  // rejects the global File implementation under vitest.
  const body = formData ?? new FormData();
  return {
    method: 'POST',
    formData: async () => body,
  } as unknown as Parameters<typeof POST>[0];
}

function authedSupabase() {
  mocks.update.mockReturnValue({ eq: mocks.updateEq });
  return {
    from: vi.fn(() => ({
      update: mocks.update,
    })),
  };
}

describe('POST /api/merchant/favicon', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkCsrfProtection.mockResolvedValue({ valid: true });
    mocks.authenticateApiRequest.mockResolvedValue({
      user: { id: 'user-1' },
      error: null,
      supabase: authedSupabase(),
    });
    mocks.getUserAccess.mockResolvedValue({
      merchantId: 'merchant-1',
      isOwner: true,
      permissions: {},
    });
    mocks.hasPermission.mockReturnValue(true);
    mocks.processFavicon.mockResolvedValue({
      svg_url: undefined,
      png_32_url: 'https://cdn/32.png',
      png_192_url: 'https://cdn/192.png',
      apple_touch_url: 'https://cdn/180.png',
    });
    mocks.updateEq.mockResolvedValue({ error: null });
  });

  it('returns 403 when CSRF validation fails (cookie request)', async () => {
    mocks.checkCsrfProtection.mockResolvedValue({ valid: false });

    const response = await POST(buildRequest());

    expect(response.status).toBe(403);
  });

  it('returns 401 when the request is not authenticated', async () => {
    mocks.authenticateApiRequest.mockResolvedValue({
      user: null,
      error: 'Invalid or expired token',
      supabase: null,
    });

    const response = await POST(buildRequest());

    expect(response.status).toBe(401);
  });

  it('returns 403 when the user cannot edit settings', async () => {
    mocks.hasPermission.mockReturnValue(false);

    const response = await POST(buildRequest());

    expect(response.status).toBe(403);
  });

  it('returns 400 when no file is provided', async () => {
    const response = await POST(buildRequest(new FormData()));

    expect(response.status).toBe(400);
    expect(mocks.processFavicon).not.toHaveBeenCalled();
  });

  it('processes the favicon and persists every variant on success', async () => {
    const form = new FormData();
    form.append(
      'file',
      new File([new Uint8Array([1, 2, 3])], 'icon.png', {
        type: 'image/png',
      })
    );

    const response = await POST(buildRequest(form));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.png_192_url).toBe('https://cdn/192.png');
    // Merchant id comes from the auth token, never the client.
    expect(mocks.processFavicon).toHaveBeenCalledWith(
      expect.any(File),
      'merchant-1',
      expect.anything()
    );
    expect(mocks.updateEq).toHaveBeenCalledWith('id', 'merchant-1');
  });

  it('clears the stored SVG favicon when a raster image is uploaded', async () => {
    // processFavicon returns no svg_url for PNG/JPEG/WEBP uploads; the route
    // must persist null so a previously stored SVG is not left in place.
    const form = new FormData();
    form.append(
      'file',
      new File([new Uint8Array([1, 2, 3])], 'icon.png', {
        type: 'image/png',
      })
    );

    await POST(buildRequest(form));

    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ favicon_svg_url: null })
    );
  });

  it('persists the SVG url when an SVG favicon is uploaded', async () => {
    mocks.processFavicon.mockResolvedValue({
      svg_url: 'https://cdn/icon.svg',
      png_32_url: 'https://cdn/32.png',
      png_192_url: 'https://cdn/192.png',
      apple_touch_url: 'https://cdn/180.png',
    });
    const form = new FormData();
    form.append(
      'file',
      new File([new Uint8Array([1, 2, 3])], 'icon.svg', {
        type: 'image/svg+xml',
      })
    );

    await POST(buildRequest(form));

    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ favicon_svg_url: 'https://cdn/icon.svg' })
    );
  });

  it('returns 400 with the real message when the image is invalid', async () => {
    mocks.processFavicon.mockRejectedValue(
      new Error('Favicon must be a PNG, JPEG, WEBP, or SVG')
    );
    const form = new FormData();
    form.append(
      'file',
      new File([new Uint8Array([1])], 'bad.txt', {
        type: 'text/plain',
      })
    );

    const response = await POST(buildRequest(form));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain('Favicon must be a PNG');
  });
});
