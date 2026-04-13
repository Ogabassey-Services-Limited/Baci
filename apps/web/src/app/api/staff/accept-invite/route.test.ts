import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockRpc = vi.fn();

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    rpc: mockRpc,
  })),
}));

import { GET } from '@/app/api/staff/accept-invite/route';

function createNextRequest(url: string) {
  return new NextRequest(url);
}

describe('GET /api/staff/accept-invite', () => {
  beforeEach(() => {
    mockRpc.mockReset();
  });

  it('returns 400 when the token is missing', async () => {
    const response = await GET(
      createNextRequest('https://usebaci.com/api/staff/accept-invite')
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'A valid invitation token is required',
    });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('returns 400 when the token is blank', async () => {
    const response = await GET(
      createNextRequest(
        'https://usebaci.com/api/staff/accept-invite?token=%20%20'
      )
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'A valid invitation token is required',
    });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('accepts non-UUID invite tokens and validates them via RPC', async () => {
    mockRpc.mockResolvedValue({
      data: [
        {
          email: 'staff@example.com',
          role: 'sales_rep',
          merchant_business_name: 'TGW Enterprise',
          invitation_expires_at: '2026-04-20T13:46:35.999Z',
        },
      ],
      error: null,
    });

    const response = await GET(
      createNextRequest(
        'https://usebaci.com/api/staff/accept-invite?token=abcdef1234567890'
      )
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      valid: true,
      email: 'staff@example.com',
      role: 'sales_rep',
      merchantName: 'TGW Enterprise',
      expiresAt: '2026-04-20T13:46:35.999Z',
    });
    expect(mockRpc).toHaveBeenCalledWith('get_staff_invite_preview', {
      p_token: 'abcdef1234567890',
    });
  });

  it('returns 404 when no invitation matches the token', async () => {
    mockRpc.mockResolvedValue({
      data: [],
      error: null,
    });

    const response = await GET(
      createNextRequest(
        'https://usebaci.com/api/staff/accept-invite?token=abcdef1234567890'
      )
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid invitation',
    });
  });

  it('returns 404 when the preview RPC returns null without an error', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: null,
    });

    const response = await GET(
      createNextRequest(
        'https://usebaci.com/api/staff/accept-invite?token=abcdef1234567890'
      )
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid invitation',
    });
  });

  it('falls back to the merchant slug when the business name is missing', async () => {
    mockRpc.mockResolvedValue({
      data: [
        {
          email: 'staff@example.com',
          role: 'sales_rep',
          merchant_business_name: null,
          merchant_slug: 'tgw-enterprise',
          invitation_expires_at: '2026-04-20T13:46:35.999Z',
        },
      ],
      error: null,
    });

    const response = await GET(
      createNextRequest(
        'https://usebaci.com/api/staff/accept-invite?token=abcdef1234567890'
      )
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      valid: true,
      email: 'staff@example.com',
      role: 'sales_rep',
      merchantName: 'tgw-enterprise',
      expiresAt: '2026-04-20T13:46:35.999Z',
    });
    expect(mockRpc).toHaveBeenCalledWith('get_staff_invite_preview', {
      p_token: 'abcdef1234567890',
    });
  });

  it('returns 500 when the invitation preview RPC fails', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: {
        message:
          'function public.get_staff_invite_preview(text) does not exist',
      },
    });

    const response = await GET(
      createNextRequest(
        'https://usebaci.com/api/staff/accept-invite?token=abcdef1234567890'
      )
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: 'Invitation service unavailable',
    });
  });
});
