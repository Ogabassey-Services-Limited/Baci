import { beforeEach, describe, expect, it } from 'vitest';
import {
  createParams,
  createRequest,
  DELETE,
  GET,
  mockCheckCsrfProtection,
  mockDeactivateVirtualTerminal,
  mockFetchVirtualTerminal,
  mockGetUser,
  mockUpdateVirtualTerminal,
  PUT,
  setupDetailRouteTest,
} from './route.test-support';

describe('/api/paystack/virtual-terminal/[code] errors', () => {
  beforeEach(setupDetailRouteTest);

  it('returns 500 when GET cannot verify terminal ownership', async () => {
    const response = await GET(createRequest('GET'), createParams());

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: 'Database error verifying terminal ownership',
    });
    expect(mockFetchVirtualTerminal).not.toHaveBeenCalled();
  });

  it('returns 500 when PUT cannot verify terminal ownership', async () => {
    const response = await PUT(
      createRequest('PUT', { name: 'Sales Terminal' }),
      createParams()
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: 'Database error verifying terminal ownership',
    });
    expect(mockUpdateVirtualTerminal).not.toHaveBeenCalled();
  });

  it('authenticates before evaluating CSRF for unauthenticated terminal updates', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    mockCheckCsrfProtection.mockResolvedValue({
      valid: false,
      response: new Response(
        JSON.stringify({ error: 'CSRF validation failed' }),
        { status: 403 }
      ),
    });

    const response = await PUT(
      createRequest('PUT', { name: 'Sales Terminal' }),
      createParams()
    );

    expect(response.status).toBe(401);
    expect(mockCheckCsrfProtection).not.toHaveBeenCalled();
  });

  it('returns 500 when DELETE cannot verify terminal ownership', async () => {
    const response = await DELETE(createRequest('DELETE'), createParams());

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: 'Database error verifying terminal ownership',
    });
    expect(mockDeactivateVirtualTerminal).not.toHaveBeenCalled();
  });
});
