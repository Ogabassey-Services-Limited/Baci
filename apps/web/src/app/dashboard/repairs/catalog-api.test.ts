import { beforeEach, describe, expect, it, vi } from 'vitest';

const { apiGet, apiPost, apiPatch, apiDelete } = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
  apiDelete: vi.fn(),
}));

vi.mock('@/lib/api-client', () => ({ apiGet, apiPost, apiPatch, apiDelete }));

import {
  commitImport,
  createDevice,
  listDevices,
  parseImport,
  searchLinkableProducts,
} from './catalog-api';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('catalog-api', () => {
  it('lists devices and unwraps the payload', async () => {
    apiGet.mockResolvedValue({ devices: [{ id: 'd-1', brand: 'Apple' }] });
    const devices = await listDevices();
    expect(apiGet).toHaveBeenCalledWith('/api/repairs/catalog/devices');
    expect(devices).toHaveLength(1);
  });

  it('encodes the search query when listing devices', async () => {
    apiGet.mockResolvedValue({ devices: [] });
    await listDevices('iphone 12');
    expect(apiGet).toHaveBeenCalledWith(
      '/api/repairs/catalog/devices?q=iphone%2012'
    );
  });

  it('creates a device and returns it', async () => {
    apiPost.mockResolvedValue({ device: { id: 'd-9', brand: 'Apple' } });
    const device = await createDevice({ brand: 'Apple', model: 'iPhone 12' });
    expect(apiPost).toHaveBeenCalledWith('/api/repairs/catalog/devices', {
      brand: 'Apple',
      model: 'iPhone 12',
    });
    expect(device.id).toBe('d-9');
  });

  it('parses an import and returns draft rows', async () => {
    apiPost.mockResolvedValue({ rows: [{ status: 'new_device' }] });
    const rows = await parseImport('iPhone 12 screen 25000');
    expect(apiPost).toHaveBeenCalledWith('/api/repairs/catalog/import/parse', {
      text: 'iPhone 12 screen 25000',
    });
    expect(rows[0].status).toBe('new_device');
  });

  it('commits an import and returns counts', async () => {
    apiPost.mockResolvedValue({
      counts: {
        serviceTypesCreated: 0,
        devicesCreated: 1,
        quotesCreated: 1,
        quotesUpdated: 0,
      },
    });
    const counts = await commitImport([
      { brand: 'Apple', model: 'iPhone 12', repairType: 'Screen', price: 100 },
    ]);
    expect(counts.devicesCreated).toBe(1);
  });

  it('maps product search results to a picker-friendly shape', async () => {
    apiGet.mockResolvedValue({
      products: [
        { id: 'p-1', name: 'iPhone 12', images: ['https://img/1.jpg'] },
        { id: 'p-2', name: 'iPhone 13', images: [] },
      ],
    });
    const results = await searchLinkableProducts('iphone');
    expect(apiGet).toHaveBeenCalledWith('/api/products?search=iphone&limit=10');
    expect(results[0]).toEqual({
      id: 'p-1',
      name: 'iPhone 12',
      imageUrl: 'https://img/1.jpg',
    });
    expect(results[1].imageUrl).toBeNull();
  });
});
