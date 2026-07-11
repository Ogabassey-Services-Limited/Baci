import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
}));

vi.mock('@/lib/api-client', () => ({
  apiGet: mocks.apiGet,
  apiPost: mocks.apiPost,
  apiPatch: mocks.apiPatch,
}));

const {
  listBookings,
  updateBooking,
  requestPickup,
  saveRepairSettings,
  getBooking,
} = await import('./bookings-api');

describe('bookings-api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.apiGet.mockResolvedValue({});
    mocks.apiPost.mockResolvedValue({});
    mocks.apiPatch.mockResolvedValue({});
  });

  it('builds the list query string from filters', async () => {
    await listBookings({
      status: 'pending',
      q: 'iphone',
      limit: 10,
      offset: 20,
    });
    expect(mocks.apiGet).toHaveBeenCalledWith(
      '/api/repairs/bookings?status=pending&q=iphone&limit=10&offset=20'
    );
  });

  it('omits empty filters', async () => {
    await listBookings();
    expect(mocks.apiGet).toHaveBeenCalledWith('/api/repairs/bookings');
  });

  it('gets a single booking by id', async () => {
    await getBooking('r-1');
    expect(mocks.apiGet).toHaveBeenCalledWith('/api/repairs/bookings/r-1');
  });

  it('patches a booking update', async () => {
    await updateBooking('r-1', { status: 'confirmed' });
    expect(mocks.apiPatch).toHaveBeenCalledWith('/api/repairs/bookings/r-1', {
      status: 'confirmed',
    });
  });

  it('posts a pickup request with the mode', async () => {
    await requestPickup('r-1', 'manual');
    expect(mocks.apiPost).toHaveBeenCalledWith(
      '/api/repairs/bookings/r-1/pickup',
      { mode: 'manual' }
    );
  });

  it('patches repair settings', async () => {
    await saveRepairSettings({ pickup_enabled: true });
    expect(mocks.apiPatch).toHaveBeenCalledWith('/api/repairs/settings', {
      pickup_enabled: true,
    });
  });
});
