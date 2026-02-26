import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGenerateContent, mockGetGenerativeModel } = vi.hoisted(() => ({
  mockGenerateContent: vi.fn(),
  mockGetGenerativeModel: vi.fn(),
}));

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn(function GoogleGenerativeAIMock() {
    return {
      getGenerativeModel: mockGetGenerativeModel,
    };
  }),
}));

vi.mock('@/lib/supabase/anon', () => ({
  createAnonClient: vi.fn(),
}));

import { createAnonClient } from '@/lib/supabase/anon';
import { POST } from './route';

describe('POST /api/ai/grade-device', () => {
  const mockSupabase = {
    from: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockGetGenerativeModel.mockReturnValue({
      generateContent: mockGenerateContent,
    });

    mockGenerateContent.mockResolvedValue({
      response: {
        text: () =>
          JSON.stringify({
            model: 'iPhone 13 Pro',
            grade: 'Good',
            observations: ['Minor frame scratches', 'Screen looks intact'],
            confidence: 88,
          }),
      },
    });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table !== 'products') {
        throw new Error(`Unexpected table: ${table}`);
      }

      return {
        select: vi.fn().mockReturnThis(),
        ilike: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: [
            {
              name: 'Apple iPhone 13 Pro 256GB',
              price: 750000,
              image: null,
            },
          ],
          error: null,
        }),
      };
    });

    vi.mocked(createAnonClient).mockReturnValue(mockSupabase as never);
  });

  it('analyzes device video using anon client product lookup (no cookie session required)', async () => {
    const formData = new FormData();
    formData.append(
      'video',
      new Blob([new Uint8Array([1, 2, 3])], { type: 'video/mp4' }),
      'device-video.mp4'
    );

    const request = {
      formData: vi.fn().mockResolvedValue(formData),
    } as unknown as NextRequest;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.model).toBe('iPhone 13 Pro');
    expect(data.data.matchedProduct).toBe('Apple iPhone 13 Pro 256GB');
    expect(data.data.basePrice).toBe(750000);
    expect(createAnonClient).toHaveBeenCalledOnce();
    expect(mockSupabase.from).toHaveBeenCalledWith('products');
  });
});
