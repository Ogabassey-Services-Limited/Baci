import { afterEach, describe, expect, it, vi } from 'vitest';

const mockFetchWithCsrf = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api-client', () => ({ fetchWithCsrf: mockFetchWithCsrf }));

import { requestDeviceGrading } from './request-device-grading';

describe('requestDeviceGrading', () => {
  afterEach(() => vi.clearAllMocks());

  it('sends the device video through the CSRF-aware grading endpoint', async () => {
    const video = new File(['video'], 'device.mp4', { type: 'video/mp4' });
    const result = {
      model: 'iPhone 14',
      grade: 'Good' as const,
      observations: [],
      basePrice: 400000,
      estimatedValue: 320000,
      deductionPercent: 20,
      matchedProduct: 'iPhone 14',
    };
    mockFetchWithCsrf.mockResolvedValue({
      ok: true,
      json: async () => ({ data: result }),
    });

    await expect(requestDeviceGrading(video)).resolves.toEqual(result);

    const request = mockFetchWithCsrf.mock.calls[0]?.[1] as RequestInit;
    expect(request).toMatchObject({ method: 'POST' });
    expect((request.body as FormData).get('video')).toBe(video);
  });

  it('throws the API error when grading is rejected', async () => {
    mockFetchWithCsrf.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Video is unreadable' }),
    });

    await expect(
      requestDeviceGrading(
        new File(['video'], 'device.mp4', { type: 'video/mp4' })
      )
    ).rejects.toThrow('Video is unreadable');
  });
});
