import { describe, expect, it } from 'vitest';
import type { RepairImportCommitRow } from '@/schemas/repair-catalog-admin';
import { commitImportRows, type ImportCommitRepository } from './import-commit';

interface FakeDevice {
  id: string;
  brand: string;
  model: string;
  slug: string;
  aliases: string[];
  productId: string | null;
}
interface FakeServiceType {
  id: string;
  name: string;
  slug: string;
}
interface FakeQuote {
  id: string;
  deviceId: string;
  serviceTypeId: string;
  partQuality: string | null;
  price: number;
  isFromPrice: boolean;
}

class FakeRepository implements ImportCommitRepository {
  devices: FakeDevice[] = [];
  serviceTypes: FakeServiceType[] = [];
  quotes: FakeQuote[] = [];
  private seq = 0;

  private nextId(prefix: string): string {
    this.seq += 1;
    return `${prefix}-${this.seq}`;
  }

  listServiceTypes() {
    return Promise.resolve(this.serviceTypes.map((s) => ({ ...s })));
  }

  listDevices() {
    return Promise.resolve(this.devices.map((d) => ({ ...d })));
  }

  createServiceType(input: { name: string; slug: string }) {
    const created = { id: this.nextId('svc'), ...input };
    this.serviceTypes.push(created);
    return Promise.resolve({ id: created.id });
  }

  createDevice(input: {
    brand: string;
    model: string;
    slug: string;
    deviceType: string | null;
    productId: string | null;
    aliases: string[];
  }) {
    const created = {
      id: this.nextId('dev'),
      brand: input.brand,
      model: input.model,
      slug: input.slug,
      aliases: input.aliases,
      productId: input.productId,
    };
    this.devices.push(created);
    return Promise.resolve({ id: created.id });
  }

  findQuote(
    deviceId: string,
    serviceTypeId: string,
    partQuality: string | null
  ) {
    const found = this.quotes.find(
      (q) =>
        q.deviceId === deviceId &&
        q.serviceTypeId === serviceTypeId &&
        q.partQuality === partQuality
    );
    return Promise.resolve(found ? { id: found.id } : null);
  }

  updateQuotePrice(id: string, price: number, isFromPrice: boolean) {
    const quote = this.quotes.find((q) => q.id === id);
    if (quote) {
      quote.price = price;
      quote.isFromPrice = isFromPrice;
    }
    return Promise.resolve();
  }

  createQuote(input: {
    deviceId: string;
    serviceTypeId: string;
    partQuality: string | null;
    price: number;
    isFromPrice: boolean;
  }) {
    this.quotes.push({ id: this.nextId('q'), ...input });
    return Promise.resolve();
  }
}

const row = (
  over: Partial<RepairImportCommitRow> = {}
): RepairImportCommitRow => ({
  brand: 'Apple',
  model: 'iPhone 12',
  repairType: 'Screen Replacement',
  price: 25000,
  isFromPrice: true,
  ...over,
});

describe('commitImportRows', () => {
  it('creates a new device, service type, and quote', async () => {
    const repo = new FakeRepository();
    const counts = await commitImportRows([row()], repo);
    expect(counts).toEqual({
      serviceTypesCreated: 1,
      devicesCreated: 1,
      quotesCreated: 1,
      quotesUpdated: 0,
    });
    expect(repo.devices[0].slug).toBe('apple-iphone-12');
  });

  it('is idempotent: re-committing updates instead of duplicating', async () => {
    const repo = new FakeRepository();
    await commitImportRows([row({ price: 25000 })], repo);
    const counts = await commitImportRows([row({ price: 30000 })], repo);
    expect(counts.devicesCreated).toBe(0);
    expect(counts.serviceTypesCreated).toBe(0);
    expect(counts.quotesCreated).toBe(0);
    expect(counts.quotesUpdated).toBe(1);
    expect(repo.quotes).toHaveLength(1);
    expect(repo.quotes[0].price).toBe(30000);
  });

  it('reuses one device for two service types', async () => {
    const repo = new FakeRepository();
    const counts = await commitImportRows(
      [row({ repairType: 'Screen' }), row({ repairType: 'Battery' })],
      repo
    );
    expect(counts.devicesCreated).toBe(1);
    expect(counts.serviceTypesCreated).toBe(2);
    expect(counts.quotesCreated).toBe(2);
  });

  it('uses a provided existing device id without creating a device', async () => {
    const repo = new FakeRepository();
    repo.devices.push({
      id: 'dev-existing',
      brand: 'Apple',
      model: 'iPhone 12',
      slug: 'apple-iphone-12',
      aliases: [],
      productId: null,
    });
    const counts = await commitImportRows(
      [row({ deviceId: 'dev-existing' })],
      repo
    );
    expect(counts.devicesCreated).toBe(0);
    expect(repo.quotes[0].deviceId).toBe('dev-existing');
  });

  it('uses a provided existing service type id without creating one', async () => {
    const repo = new FakeRepository();
    repo.serviceTypes.push({
      id: 'svc-existing',
      name: 'Screen Replacement',
      slug: 'screen-replacement',
    });
    const counts = await commitImportRows(
      [row({ serviceTypeId: 'svc-existing' })],
      repo
    );
    expect(counts.serviceTypesCreated).toBe(0);
    expect(repo.quotes[0].serviceTypeId).toBe('svc-existing');
  });

  it('ignores a foreign service type id and resolves by name instead', async () => {
    const repo = new FakeRepository();
    repo.serviceTypes.push({
      id: 'svc-mine',
      name: 'Screen Replacement',
      slug: 'screen-replacement',
    });
    // A tampered/foreign id that is NOT one of this merchant's service types
    // must not be trusted; it falls through to a name match on the merchant's own row.
    const counts = await commitImportRows(
      [row({ serviceTypeId: 'svc-from-another-merchant' })],
      repo
    );
    expect(counts.serviceTypesCreated).toBe(0);
    expect(repo.quotes[0].serviceTypeId).toBe('svc-mine');
  });

  it('ignores a foreign device id and resolves by brand/model instead', async () => {
    const repo = new FakeRepository();
    repo.devices.push({
      id: 'dev-mine',
      brand: 'Apple',
      model: 'iPhone 12',
      slug: 'apple-iphone-12',
      aliases: [],
      productId: null,
    });
    // A tampered/foreign device id that is NOT one of this merchant's devices
    // must not be trusted; it falls through to a brand/model match on the
    // merchant's own row rather than creating or linking a foreign device.
    const counts = await commitImportRows(
      [row({ deviceId: 'dev-from-another-merchant' })],
      repo
    );
    expect(counts.devicesCreated).toBe(0);
    expect(repo.quotes[0].deviceId).toBe('dev-mine');
  });

  it('distinguishes quotes by part quality', async () => {
    const repo = new FakeRepository();
    const counts = await commitImportRows(
      [
        row({ partQuality: 'OEM', price: 40000 }),
        row({ partQuality: 'Aftermarket', price: 25000 }),
      ],
      repo
    );
    expect(counts.quotesCreated).toBe(2);
    expect(repo.quotes).toHaveLength(2);
  });

  it('generates a unique slug when a base slug is taken', async () => {
    const repo = new FakeRepository();
    repo.devices.push({
      id: 'dev-x',
      brand: 'Other',
      model: 'Thing',
      slug: 'apple-iphone-12',
      aliases: [],
      productId: null,
    });
    await commitImportRows([row()], repo);
    const created = repo.devices.find((d) => d.id !== 'dev-x');
    expect(created?.slug).toBe('apple-iphone-12-2');
  });
});
