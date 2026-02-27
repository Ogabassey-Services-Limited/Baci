import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/anon', () => ({
  createAnonClient: vi.fn(),
}));

import { createAnonClient } from '@/lib/supabase/anon';
import { POST } from './route';

describe('POST /api/reviews/[id]/helpful', () => {
  const mockSupabase = {
    from: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createAnonClient).mockReturnValue(mockSupabase as never);
  });

  it('records a helpful vote using the anon client (no cookie session required)', async () => {
    let productReviewsCallCount = 0;

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'product_reviews') {
        productReviewsCallCount += 1;
        const response =
          productReviewsCallCount === 1
            ? { data: { id: 'review-1', status: 'approved' }, error: null }
            : { data: { helpful_count: 4 }, error: null };

        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue(response),
        };
      }

      if (table === 'review_helpful_votes') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    const request = new NextRequest(
      'http://localhost/api/reviews/review-1/helpful',
      {
        method: 'POST',
        body: JSON.stringify({ voterIdentifier: 'USER@example.com' }),
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    const response = await POST(request, {
      params: Promise.resolve({ id: 'review-1' }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ success: true, helpfulCount: 4 });
    expect(createAnonClient).toHaveBeenCalledOnce();
    expect(mockSupabase.from).toHaveBeenCalledWith('product_reviews');
    expect(mockSupabase.from).toHaveBeenCalledWith('review_helpful_votes');
  });
});
