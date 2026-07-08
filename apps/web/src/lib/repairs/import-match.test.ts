import { describe, expect, it } from 'vitest';
import { matchImportRows } from './import-match';
import type { ParsedRepairRow } from './import-parse';

const row = (over: Partial<ParsedRepairRow> = {}): ParsedRepairRow => ({
  brand: 'Apple',
  model: 'iPhone 12',
  repairType: 'Screen Replacement',
  price: 25000,
  partQuality: null,
  ...over,
});

const context = {
  devices: [
    {
      id: 'dev-existing',
      brand: 'Apple',
      model: 'iPhone 12',
      slug: 'apple-iphone-12',
      aliases: ['iphone twelve'],
      productId: 'prod-linked',
    },
  ],
  products: [
    { id: 'prod-search', name: 'Apple iPhone 13 Pro', brand: 'Apple' },
  ],
  serviceTypes: [{ id: 'svc-screen', name: 'Screen Replacement' }],
};

describe('matchImportRows', () => {
  it('marks a slug match as an existing device and keeps its linked product', () => {
    const [draft] = matchImportRows([row()], context);
    expect(draft?.status).toBe('existing_device');
    expect(draft?.deviceId).toBe('dev-existing');
    expect(draft?.suggestedProductId).toBe('prod-linked');
    expect(draft?.serviceTypeId).toBe('svc-screen');
    expect(draft?.newServiceTypeName).toBeNull();
  });

  it('matches an existing device by alias', () => {
    const [draft] = matchImportRows([row({ model: 'iPhone Twelve' })], context);
    expect(draft?.status).toBe('existing_device');
    expect(draft?.deviceId).toBe('dev-existing');
  });

  it('marks an unknown device as new and suggests a product by name', () => {
    const [draft] = matchImportRows([row({ model: 'iPhone 13 Pro' })], context);
    expect(draft?.status).toBe('new_device');
    expect(draft?.deviceId).toBeNull();
    expect(draft?.suggestedProductId).toBe('prod-search');
  });

  it('marks duplicate device candidates as ambiguous', () => {
    const ambiguousContext = {
      ...context,
      devices: [
        {
          id: 'dev-a',
          brand: 'Apple',
          model: 'iPhone 12',
          slug: 'apple-iphone-12',
          aliases: [],
          productId: null,
        },
        {
          id: 'dev-b',
          brand: 'Apple',
          model: 'iPhone 12',
          slug: 'apple-iphone-12-oem',
          aliases: [],
          productId: null,
        },
      ],
    };
    const [draft] = matchImportRows([row()], ambiguousContext);
    expect(draft?.status).toBe('ambiguous');
    expect(draft?.deviceId).toBeNull();
  });

  it('proposes a new service type when none matches', () => {
    const [draft] = matchImportRows(
      [row({ repairType: 'Charging Port' })],
      context
    );
    expect(draft?.serviceTypeId).toBeNull();
    expect(draft?.newServiceTypeName).toBe('Charging Port');
  });

  it('matches a service type by partial name', () => {
    const [draft] = matchImportRows([row({ repairType: 'Screen' })], context);
    expect(draft?.serviceTypeId).toBe('svc-screen');
    expect(draft?.newServiceTypeName).toBeNull();
  });

  it('does not suggest a product when none matches the device name', () => {
    const [draft] = matchImportRows([row({ brand: 'Nokia', model: '3310' })], {
      ...context,
      devices: [],
    });
    expect(draft?.status).toBe('new_device');
    expect(draft?.suggestedProductId).toBeNull();
  });
});
