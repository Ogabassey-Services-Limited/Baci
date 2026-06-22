import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '@/lib/products';

const mocks = vi.hoisted(() => ({
  ensurePermission: vi.fn(),
  generateObject: vi.fn(),
  getUser: vi.fn(),
  isMerchantPermissionRedirectError: vi.fn(),
  withRetry: vi.fn(),
}));

vi.mock('ai', () => ({
  generateObject: (...args: unknown[]) => mocks.generateObject(...args),
}));

vi.mock('@/ai/provider', () => ({
  gemini25FlashImage: 'gemini-image-test-model',
  geminiFlash: 'gemini-test-model',
  sanitizePromptInput: (value: string) => ({ value }),
  withRetry: (operation: () => Promise<unknown>) => mocks.withRetry(operation),
}));

vi.mock('@/lib/merchant-server', () => ({
  ensurePermission: (...args: unknown[]) => mocks.ensurePermission(...args),
  isMerchantPermissionRedirectError: (error: unknown) =>
    mocks.isMerchantPermissionRedirectError(error),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: mocks.getUser,
    },
  })),
}));

const { fetchGoogleSheet, parseCSVDirectly, processPriceList } = await import(
  './actions'
);

const existingProducts = [
  {
    id: 'product-1',
    name: 'Old Phone',
    price: 1000,
    sku: 'OLD-1',
    stock: 5,
  },
] as unknown as Product[];

describe('product import actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });
    mocks.ensurePermission.mockResolvedValue({
      merchant: { id: 'merchant-1' },
      staffAccess: { isOwner: true },
    });
    mocks.isMerchantPermissionRedirectError.mockReturnValue(false);
    mocks.withRetry.mockImplementation((operation: () => Promise<unknown>) =>
      operation()
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not process price lists with AI for unauthenticated callers', async () => {
    mocks.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });

    const result = await processPriceList(
      existingProducts,
      'Name,Price\nNew Phone,2000',
      'Vendor',
      'text/csv'
    );

    expect(result).toEqual({ changes: [], summary: 'Unauthorized' });
    expect(mocks.ensurePermission).not.toHaveBeenCalled();
    expect(mocks.generateObject).not.toHaveBeenCalled();
  });

  it('does not process price lists with AI when auth lookup returns an error', async () => {
    mocks.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: new Error('Auth lookup failed'),
    });

    const result = await processPriceList(
      existingProducts,
      'Name,Price\nNew Phone,2000',
      'Vendor',
      'text/csv'
    );

    expect(result).toEqual({ changes: [], summary: 'Unauthorized' });
    expect(mocks.ensurePermission).not.toHaveBeenCalled();
    expect(mocks.generateObject).not.toHaveBeenCalled();
  });

  it('does not process price lists with AI when product create permission is denied', async () => {
    mocks.ensurePermission.mockRejectedValueOnce(new Error('Forbidden'));
    mocks.isMerchantPermissionRedirectError.mockReturnValueOnce(true);

    const result = await processPriceList(
      existingProducts,
      'Name,Price\nNew Phone,2000',
      'Vendor',
      'text/csv'
    );

    expect(result).toEqual({ changes: [], summary: 'Unauthorized' });
    expect(mocks.ensurePermission).toHaveBeenCalledWith('products', 'create');
    expect(mocks.generateObject).not.toHaveBeenCalled();
  });

  it('surfaces unexpected product permission failures during price list processing', async () => {
    mocks.ensurePermission.mockRejectedValueOnce(
      new Error('Permission store down')
    );
    mocks.isMerchantPermissionRedirectError.mockReturnValueOnce(false);

    await expect(
      processPriceList(
        existingProducts,
        'Name,Price\nNew Phone,2000',
        'Vendor',
        'text/csv'
      )
    ).rejects.toThrow('Permission store down');

    expect(mocks.generateObject).not.toHaveBeenCalled();
  });

  it('does not process price lists when input validation fails', async () => {
    const result = await processPriceList(
      existingProducts,
      'Name,Price\nNew Phone,2000',
      'Vendor',
      'not-a-mime-type'
    );

    expect(result).toEqual({ changes: [], summary: 'Invalid input' });
    expect(mocks.ensurePermission).not.toHaveBeenCalled();
    expect(mocks.generateObject).not.toHaveBeenCalled();
  });

  it('accepts legacy text file type labels for pasted AI imports', async () => {
    mocks.generateObject.mockResolvedValueOnce({
      object: {
        changes: [],
        summary: 'Processed pasted price list',
      },
    });

    const result = await processPriceList(
      existingProducts,
      'Name,Price\nNew Phone,2000',
      'Pasted text',
      'text'
    );

    expect(result).toEqual({
      changes: [],
      summary: 'Processed pasted price list',
    });
    expect(mocks.ensurePermission).toHaveBeenCalledWith('products', 'create');
    expect(mocks.generateObject).toHaveBeenCalledOnce();
    expect(JSON.stringify(mocks.generateObject.mock.calls[0]?.[0])).toContain(
      'Format: text/plain'
    );
  });

  it('accepts legacy csv file type labels for Google Sheet AI fallback imports', async () => {
    mocks.generateObject.mockResolvedValueOnce({
      object: {
        changes: [],
        summary: 'Processed Google Sheet price list',
      },
    });

    const result = await processPriceList(
      existingProducts,
      'Name,Price\nNew Phone,2000',
      'Google Sheet Sync',
      'csv'
    );

    expect(result).toEqual({
      changes: [],
      summary: 'Processed Google Sheet price list',
    });
    expect(mocks.ensurePermission).toHaveBeenCalledWith('products', 'create');
    expect(mocks.generateObject).toHaveBeenCalledOnce();
    expect(JSON.stringify(mocks.generateObject.mock.calls[0]?.[0])).toContain(
      'Format: text/csv'
    );
  });

  it('processes image price lists without duplicating base64 in the text prompt', async () => {
    const imagePayload = 'data:image/png;base64,THIS_SHOULD_ONLY_BE_IMAGE_DATA';
    mocks.generateObject.mockResolvedValueOnce({
      object: {
        changes: [],
        summary: 'Processed image price list',
      },
    });

    const result = await processPriceList(
      existingProducts,
      imagePayload,
      'Vendor',
      'image/png'
    );

    expect(result).toEqual({
      changes: [],
      summary: 'Processed image price list',
    });
    expect(mocks.generateObject).toHaveBeenCalledOnce();
    const call = mocks.generateObject.mock.calls[0]?.[0] as {
      messages?: Array<{
        content?: Array<{ type: string; text?: string; image?: string }>;
      }>;
    };
    const content = call.messages?.[0]?.content ?? [];
    const textPart = content.find((part) => part.type === 'text');
    const imagePart = content.find((part) => part.type === 'image');

    expect(textPart?.text).toContain('Image attachment supplied separately');
    expect(textPart?.text).not.toContain(imagePayload);
    expect(imagePart?.image).toBe(imagePayload);
  });

  it('processes price lists with AI after product create authorization', async () => {
    const productsWithExtraFields = [
      {
        ...existingProducts[0],
        internal_secret_note: 'do not send this to the model',
      },
    ] as unknown as Product[];
    mocks.generateObject.mockResolvedValueOnce({
      object: {
        changes: [
          {
            details: {
              name: 'New Phone',
              price: 2000,
            },
            type: 'new',
          },
        ],
        summary: 'Found 1 new product',
      },
    });

    const result = await processPriceList(
      productsWithExtraFields,
      'Name,Price\nNew Phone,2000',
      'Vendor',
      'text/csv'
    );

    expect(result).toEqual({
      changes: [
        {
          details: {
            name: 'New Phone',
            price: 2000,
          },
          type: 'new',
        },
      ],
      summary: 'Found 1 new product',
    });
    expect(mocks.ensurePermission).toHaveBeenCalledWith('products', 'create');
    expect(mocks.generateObject).toHaveBeenCalledOnce();
    expect(
      JSON.stringify(mocks.generateObject.mock.calls[0]?.[0])
    ).not.toContain('internal_secret_note');
  });

  it('does not parse CSV for unauthenticated callers', async () => {
    mocks.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });

    const result = await parseCSVDirectly(
      existingProducts,
      'Name,Price\nNew Phone,2000'
    );

    expect(result).toEqual({ changes: [], summary: 'Unauthorized' });
    expect(mocks.ensurePermission).not.toHaveBeenCalled();
  });

  it('does not parse CSV when auth lookup returns an error', async () => {
    mocks.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: new Error('Auth lookup failed'),
    });

    const result = await parseCSVDirectly(
      existingProducts,
      'Name,Price\nNew Phone,2000'
    );

    expect(result).toEqual({ changes: [], summary: 'Unauthorized' });
    expect(mocks.ensurePermission).not.toHaveBeenCalled();
  });

  it('does not parse CSV when product create permission is denied', async () => {
    mocks.ensurePermission.mockRejectedValueOnce(new Error('Denied'));
    mocks.isMerchantPermissionRedirectError.mockReturnValueOnce(true);

    const result = await parseCSVDirectly(
      existingProducts,
      'Name,Price\nNew Phone,2000'
    );

    expect(result).toEqual({ changes: [], summary: 'Unauthorized' });
    expect(mocks.ensurePermission).toHaveBeenCalledWith('products', 'create');
  });

  it('returns structural CSV parser errors for unrecognized headers so AI fallback can run', async () => {
    const result = await parseCSVDirectly(
      existingProducts,
      'SKU,Quantity\nOLD-1,5'
    );

    expect(result).toEqual({
      changes: [],
      summary:
        'Could not find "Name" and "Price" columns in the first 10 rows. Please add headers to your sheet (e.g., "Product Name", "Price").',
    });
    expect(mocks.ensurePermission).toHaveBeenCalledWith('products', 'create');
  });

  it('does not parse CSV when product payload validation fails', async () => {
    const result = await parseCSVDirectly(
      [
        {
          id: '',
          name: 'Invalid product',
          price: 1000,
        },
      ] as unknown as Product[],
      'Name,Price\nNew Phone,2000'
    );

    expect(result).toEqual({ changes: [], summary: 'Invalid input' });
    expect(mocks.ensurePermission).not.toHaveBeenCalled();
  });

  it('parses CSV after product create authorization', async () => {
    const result = await parseCSVDirectly(
      existingProducts,
      'Name,Price,SKU\nNew Phone,2000,NEW-1'
    );

    expect(mocks.ensurePermission).toHaveBeenCalledWith('products', 'create');
    expect(result.summary).toContain('Parsed 1 products from CSV');
    expect(result.changes).toEqual([
      {
        details: {
          category: 'General',
          image: undefined,
          name: 'New Phone',
          price: 2000,
          sku: 'NEW-1',
          stock: 0,
        },
        type: 'new',
      },
      {
        details: {
          name: 'Old Phone',
          price: 1000,
          sku: 'OLD-1',
        },
        productId: 'product-1',
        reason: 'Not found in updated price list',
        type: 'remove',
      },
    ]);
  });

  it('parses cost price from CSV without treating it as the selling price', async () => {
    const result = await parseCSVDirectly(
      existingProducts,
      'Name,Cost Price,Selling Price,SKU\nNew Phone,1500,2000,NEW-1'
    );

    expect(result.summary).toContain('Parsed 1 products from CSV');
    expect(result.changes[0]).toEqual({
      details: {
        category: 'General',
        cost_price: 1500,
        image: undefined,
        name: 'New Phone',
        price: 2000,
        sku: 'NEW-1',
        stock: 0,
      },
      type: 'new',
    });
  });

  it('treats cost amount headers as cost columns, not selling prices', async () => {
    const result = await parseCSVDirectly(
      existingProducts,
      'Name,Cost Amount,Selling Price,SKU\nNew Phone,1500,2000,NEW-1'
    );

    expect(result.summary).toContain('Parsed 1 products from CSV');
    expect(result.changes[0]).toEqual({
      details: {
        category: 'General',
        cost_price: 1500,
        image: undefined,
        name: 'New Phone',
        price: 2000,
        sku: 'NEW-1',
        stock: 0,
      },
      type: 'new',
    });
  });

  it('does not use a cost amount column as the selling price', async () => {
    const result = await parseCSVDirectly(
      existingProducts,
      'Name,Cost Amount,SKU\nNew Phone,1500,NEW-1'
    );

    expect(result).toEqual({
      changes: [],
      summary:
        'Could not find "Name" and "Price" columns in the first 10 rows. Please add headers to your sheet (e.g., "Product Name", "Price").',
    });
  });

  it('parses currency-code-prefixed cost prices', async () => {
    const result = await parseCSVDirectly(
      existingProducts,
      'Name,Selling Price,Cost Price,SKU\nNew Phone,"NGN 2,000","USD 10",NEW-1'
    );

    expect(result.summary).toContain('Parsed 1 products from CSV');
    expect(result.changes[0]).toMatchObject({
      details: {
        cost_price: 10,
        price: 2000,
      },
      type: 'new',
    });
  });

  it('parses currency-code-prefixed amounts without spaces', async () => {
    const result = await parseCSVDirectly(
      existingProducts,
      'Name,Selling Price,Cost Price,SKU\nNew Phone,"NGN2,000",USD10,NEW-1'
    );

    expect(result.summary).toContain('Parsed 1 products from CSV');
    expect(result.changes[0]).toMatchObject({
      details: {
        cost_price: 10,
        price: 2000,
      },
      type: 'new',
    });
  });

  it('does not treat a standalone supplier column as a cost price', async () => {
    const result = await parseCSVDirectly(
      existingProducts,
      'Name,Supplier,Cost Price,Selling Price,SKU\nNew Phone,Acme,1500,2000,NEW-1'
    );

    expect(result.summary).toContain('Parsed 1 products from CSV');
    expect(result.changes[0]).toMatchObject({
      details: {
        cost_price: 1500,
        price: 2000,
      },
      type: 'new',
    });
  });

  it('uses the price column instead of a preceding tax rate column', async () => {
    const result = await parseCSVDirectly(
      existingProducts,
      'Name,Tax Rate,Price,SKU\nNew Phone,7.5,2000,NEW-1'
    );

    expect(result.summary).toContain('Parsed 1 products from CSV');
    expect(result.changes[0]).toMatchObject({
      details: {
        price: 2000,
      },
      type: 'new',
    });
  });

  it('uses the price column instead of a preceding tax amount column', async () => {
    const result = await parseCSVDirectly(
      existingProducts,
      'Name,Tax Amount,Price,SKU\nNew Phone,150,2000,NEW-1'
    );

    expect(result.summary).toContain('Parsed 1 products from CSV');
    expect(result.changes[0]).toMatchObject({
      details: {
        price: 2000,
      },
      type: 'new',
    });
  });

  it('emits an update when only cost price changes for an existing product', async () => {
    const result = await parseCSVDirectly(
      [
        {
          ...existingProducts[0],
          cost_price: 700,
        },
      ] as unknown as Product[],
      'Name,Selling Price,Cost Price,SKU\nOld Phone,1000,800,OLD-1'
    );

    expect(result.changes).toEqual([
      {
        details: {
          cost_price: 800,
          category: undefined,
          image: undefined,
          name: 'Old Phone',
          price: 1000,
          sku: 'OLD-1',
          stock: 5,
        },
        newPrice: 1000,
        productId: 'product-1',
        reason: 'Cost price changed from 700 to 800',
        type: 'update',
      },
    ]);
  });

  it('omits non-numeric cost prices from parsed products', async () => {
    const result = await parseCSVDirectly(
      existingProducts,
      'Name,Selling Price,Cost Price,SKU\nNew Phone,2000,not available,NEW-1'
    );

    expect(result.summary).toContain('Parsed 1 products from CSV');
    expect(result.changes[0]?.details).not.toHaveProperty('cost_price');
  });

  it('omits negative cost prices from parsed products', async () => {
    const result = await parseCSVDirectly(
      existingProducts,
      'Name,Selling Price,Cost Price,SKU\nNew Phone,2000,-1500,NEW-1'
    );

    expect(result.summary).toContain('Parsed 1 products from CSV');
    expect(result.changes[0]?.details).not.toHaveProperty('cost_price');
  });

  it('keeps zero cost prices from parsed products', async () => {
    const result = await parseCSVDirectly(
      existingProducts,
      'Name,Selling Price,Cost Price,SKU\nNew Phone,2000,0,NEW-1'
    );

    expect(result.summary).toContain('Parsed 1 products from CSV');
    expect(result.changes[0]?.details.cost_price).toBe(0);
  });

  it('parses products when the cost price column is missing', async () => {
    const result = await parseCSVDirectly(
      existingProducts,
      'Name,Selling Price,SKU\nNew Phone,2000,NEW-1'
    );

    expect(result.summary).toContain('Parsed 1 products from CSV');
    expect(result.changes[0]).toMatchObject({
      details: {
        name: 'New Phone',
        price: 2000,
        sku: 'NEW-1',
      },
      type: 'new',
    });
    expect(result.changes[0]?.details).not.toHaveProperty('cost_price');
  });

  it('emits one update when price and cost price both change', async () => {
    const result = await parseCSVDirectly(
      [
        {
          ...existingProducts[0],
          cost_price: 700,
        },
      ] as unknown as Product[],
      'Name,Selling Price,Cost Price,SKU\nOld Phone,1200,800,OLD-1'
    );

    expect(result.changes).toEqual([
      {
        details: {
          cost_price: 800,
          category: undefined,
          image: undefined,
          name: 'Old Phone',
          price: 1000,
          sku: 'OLD-1',
          stock: 5,
        },
        newPrice: 1200,
        productId: 'product-1',
        reason:
          'Price changed from 1000 to 1200; Cost price changed from 700 to 800',
        type: 'update',
      },
    ]);
  });

  it('describes a newly set cost price without pretending the old value was zero', async () => {
    const result = await parseCSVDirectly(
      existingProducts,
      'Name,Selling Price,Cost Price,SKU\nOld Phone,1000,800,OLD-1'
    );

    expect(result.changes).toEqual([
      {
        details: {
          cost_price: 800,
          category: undefined,
          image: undefined,
          name: 'Old Phone',
          price: 1000,
          sku: 'OLD-1',
          stock: 5,
        },
        newPrice: 1000,
        productId: 'product-1',
        reason: 'Cost price set to 800',
        type: 'update',
      },
    ]);
  });

  it('emits an update when an existing product without cost price imports zero cost', async () => {
    const result = await parseCSVDirectly(
      existingProducts,
      'Name,Selling Price,Cost Price,SKU\nOld Phone,1000,0,OLD-1'
    );

    expect(result.changes).toEqual([
      {
        details: {
          cost_price: 0,
          category: undefined,
          image: undefined,
          name: 'Old Phone',
          price: 1000,
          sku: 'OLD-1',
          stock: 5,
        },
        newPrice: 1000,
        productId: 'product-1',
        reason: 'Cost price set to 0',
        type: 'update',
      },
    ]);
  });

  it('does not re-emit cost updates when an existing zero cost is reimported', async () => {
    const result = await parseCSVDirectly(
      [
        {
          ...existingProducts[0],
          cost_price: 0,
        },
      ] as unknown as Product[],
      'Name,Selling Price,Cost Price,SKU\nOld Phone,1000,0,OLD-1'
    );

    expect(result.changes).toEqual([]);
  });

  it('skips rows with invalid selling prices', async () => {
    const result = await parseCSVDirectly(
      existingProducts,
      'Name,Selling Price,Cost Price,SKU\nNew Phone,not-a-price,1500,NEW-1'
    );

    expect(result.changes).toEqual([]);
    expect(result.summary).toContain('Parsed 0 products from CSV');
    expect(result.summary).toContain('Skipped 1 rows');
  });

  it('does not archive existing products that are present with invalid prices', async () => {
    const result = await parseCSVDirectly(
      [
        ...existingProducts,
        {
          id: 'product-2',
          name: 'Keep Phone',
          price: 2000,
          sku: 'KEEP-1',
          stock: 3,
        },
      ] as unknown as Product[],
      'Name,Selling Price,SKU\nOld Phone,not-a-price,OLD-1\nKeep Phone,2000,KEEP-1'
    );

    expect(result.changes).toEqual([]);
    expect(result.summary).toContain('Parsed 1 products from CSV');
    expect(result.summary).toContain('Skipped 1 rows');
  });

  it('skips rows with non-finite selling prices', async () => {
    const result = await parseCSVDirectly(
      existingProducts,
      'Name,Selling Price,Cost Price,SKU\nNew Phone,Infinity,1500,NEW-1\nOther Phone,-Infinity,1200,NEW-2'
    );

    expect(result.changes).toEqual([]);
    expect(result.summary).toContain('Parsed 0 products from CSV');
    expect(result.summary).toContain('Skipped 2 rows');
  });

  it('omits non-finite cost prices from parsed products', async () => {
    const result = await parseCSVDirectly(
      [],
      'Name,Selling Price,Cost Price,SKU\nNew Phone,2000,Infinity,NEW-1\nOther Phone,1800,-Infinity,NEW-2'
    );

    expect(result.summary).toContain('Parsed 2 products from CSV');
    expect(result.summary).toContain('Skipped 0 rows');
    expect(result.changes).toHaveLength(2);
    expect(result.changes[0]?.details).not.toHaveProperty('cost_price');
    expect(result.changes[1]?.details).not.toHaveProperty('cost_price');
  });

  it('parses supported INR and BRL price prefixes', async () => {
    const result = await parseCSVDirectly(
      existingProducts,
      'Name,Selling Price,Cost Price,SKU\nIndia Phone,"INR 12,500","BRL 2,000",IN-1'
    );

    expect(result.summary).toContain('Parsed 1 products from CSV');
    expect(result.changes[0]).toMatchObject({
      details: {
        cost_price: 2000,
        price: 12500,
      },
      type: 'new',
    });
  });

  it('skips fee columns before selecting the selling price', async () => {
    const result = await parseCSVDirectly(
      existingProducts,
      'Name,Selling Fee,Retail Fee,Price,SKU\nNew Phone,25,30,2000,NEW-1'
    );

    expect(result.summary).toContain('Parsed 1 products from CSV');
    expect(result.changes[0]).toMatchObject({
      details: {
        price: 2000,
      },
      type: 'new',
    });
  });

  it('skips plural fee columns before selecting the selling price', async () => {
    const result = await parseCSVDirectly(
      existingProducts,
      'Name,Selling Fees,Retail Fees,Price,SKU\nNew Phone,25,30,2000,NEW-1'
    );

    expect(result.summary).toContain('Parsed 1 products from CSV');
    expect(result.changes[0]).toMatchObject({
      details: {
        price: 2000,
      },
      type: 'new',
    });
  });

  it('does not import shipping cost as product cost price', async () => {
    const result = await parseCSVDirectly(
      existingProducts,
      'Name,Price,Shipping Cost,SKU\nNew Phone,2000,400,NEW-1'
    );

    expect(result.summary).toContain('Parsed 1 products from CSV');
    expect(result.changes[0]).toMatchObject({
      details: {
        price: 2000,
      },
      type: 'new',
    });
    expect(result.changes[0]?.details).not.toHaveProperty('cost_price');
  });

  it('does not import supplier shipping costs as product cost price', async () => {
    const result = await parseCSVDirectly(
      existingProducts,
      'Name,Price,Supplier Shipping Cost,SKU\nNew Phone,2000,400,NEW-1'
    );

    expect(result.summary).toContain('Parsed 1 products from CSV');
    expect(result.changes[0]).toMatchObject({
      details: {
        price: 2000,
      },
      type: 'new',
    });
    expect(result.changes[0]?.details).not.toHaveProperty('cost_price');
  });

  it('does not import cost center metadata as product cost price', async () => {
    const result = await parseCSVDirectly(
      existingProducts,
      'Name,Price,Cost Center,SKU\nNew Phone,2000,12345,NEW-1'
    );

    expect(result.summary).toContain('Parsed 1 products from CSV');
    expect(result.changes[0]).toMatchObject({
      details: {
        price: 2000,
      },
      type: 'new',
    });
    expect(result.changes[0]?.details).not.toHaveProperty('cost_price');
  });

  it('imports unit cost headers as product cost price', async () => {
    const result = await parseCSVDirectly(
      existingProducts,
      'Name,Price,Unit Cost,SKU\nNew Phone,2000,1200,NEW-1'
    );

    expect(result.summary).toContain('Parsed 1 products from CSV');
    expect(result.changes[0]).toMatchObject({
      details: {
        cost_price: 1200,
        price: 2000,
      },
      type: 'new',
    });
  });

  it('does not import purchase metadata as product cost price', async () => {
    const result = await parseCSVDirectly(
      existingProducts,
      'Name,Price,Purchase Order,Purchase Date,SKU\nNew Phone,2000,12345,2026-06-01,NEW-1'
    );

    expect(result.summary).toContain('Parsed 1 products from CSV');
    expect(result.changes[0]).toMatchObject({
      details: {
        price: 2000,
      },
      type: 'new',
    });
    expect(result.changes[0]?.details).not.toHaveProperty('cost_price');
  });

  it('uses the explicit price column instead of retailer metadata', async () => {
    const result = await parseCSVDirectly(
      existingProducts,
      'Name,Retailer,Price,SKU\nNew Phone,Partner Shop,2000,NEW-1'
    );

    expect(result.summary).toContain('Parsed 1 products from CSV');
    expect(result.changes[0]).toMatchObject({
      details: {
        price: 2000,
      },
      type: 'new',
    });
  });

  it('accepts tax-inclusive price headers as selling prices', async () => {
    const result = await parseCSVDirectly(
      existingProducts,
      'Name,Price incl VAT,SKU\nNew Phone,2000,NEW-1'
    );

    expect(result.summary).toContain('Parsed 1 products from CSV');
    expect(result.changes[0]).toMatchObject({
      details: {
        price: 2000,
      },
      type: 'new',
    });
  });

  it('accepts VAT-inclusive amount headers as selling prices', async () => {
    const result = await parseCSVDirectly(
      existingProducts,
      'Name,Amount incl VAT,SKU\nNew Phone,2000,NEW-1'
    );

    expect(result.summary).toContain('Parsed 1 products from CSV');
    expect(result.changes[0]).toMatchObject({
      details: {
        price: 2000,
      },
      type: 'new',
    });
  });

  it('keeps discounted final price headers eligible', async () => {
    const result = await parseCSVDirectly(
      existingProducts,
      'Name,Discount Amount,Price After Discount,SKU\nNew Phone,250,2000,NEW-1'
    );

    expect(result.summary).toContain('Parsed 1 products from CSV');
    expect(result.changes[0]).toMatchObject({
      details: {
        price: 2000,
      },
      type: 'new',
    });
  });

  it('parses localized currency strings before importing prices', async () => {
    const result = await parseCSVDirectly(
      existingProducts,
      'Name,Selling Price,Cost Price,SKU\nBrazil Phone,"R$ 1.234,56","GH₵2,000",BR-1'
    );

    expect(result.summary).toContain('Parsed 1 products from CSV');
    expect(result.changes[0]).toMatchObject({
      details: {
        cost_price: 2000,
        price: 1234.56,
      },
      type: 'new',
    });
  });

  it('does not use a standalone cost column as the selling price', async () => {
    const result = await parseCSVDirectly(
      existingProducts,
      'Name,Cost,SKU\nNew Phone,1500,NEW-1'
    );

    expect(result).toEqual({
      changes: [],
      summary:
        'Could not find "Name" and "Price" columns in the first 10 rows. Please add headers to your sheet (e.g., "Product Name", "Price").',
    });
  });

  it('detects first-time fractional cost price updates', async () => {
    const result = await parseCSVDirectly(
      existingProducts,
      'Name,Price,Cost Price,SKU\nOld Phone,1000,0.005,OLD-1'
    );

    expect(result.changes[0]).toMatchObject({
      details: {
        cost_price: 0.005,
        price: 1000,
      },
      productId: 'product-1',
      type: 'update',
    });
  });

  it('does not fetch Google Sheets for unauthenticated callers', async () => {
    mocks.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    await expect(
      fetchGoogleSheet('https://docs.google.com/spreadsheets/d/sheet-id/edit')
    ).rejects.toThrow('Unauthorized');

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('does not fetch Google Sheets when auth lookup returns an error', async () => {
    mocks.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: new Error('Auth lookup failed'),
    });
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    await expect(
      fetchGoogleSheet('https://docs.google.com/spreadsheets/d/sheet-id/edit')
    ).rejects.toThrow('Unauthorized');

    expect(mocks.ensurePermission).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('does not fetch Google Sheets when product create permission is denied', async () => {
    mocks.ensurePermission.mockRejectedValueOnce(new Error('Forbidden'));
    mocks.isMerchantPermissionRedirectError.mockReturnValueOnce(true);
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    await expect(
      fetchGoogleSheet('https://docs.google.com/spreadsheets/d/sheet-id/edit')
    ).rejects.toThrow('Unauthorized');

    expect(mocks.ensurePermission).toHaveBeenCalledWith('products', 'create');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('does not fetch Google Sheets when input validation fails', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    await expect(fetchGoogleSheet('not-a-url')).rejects.toThrow(
      'Invalid URL format. Please provide a valid Google Sheets URL.'
    );

    expect(mocks.ensurePermission).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('fetches Google Sheets after product create authorization', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      statusText: 'OK',
      text: async () => 'Name,Price\nNew Phone,2000',
    });
    vi.stubGlobal('fetch', fetchSpy);

    await expect(
      fetchGoogleSheet('https://docs.google.com/spreadsheets/d/sheet-id/edit')
    ).resolves.toBe('Name,Price\nNew Phone,2000');

    expect(mocks.ensurePermission).toHaveBeenCalledWith('products', 'create');
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://docs.google.com/spreadsheets/d/sheet-id/export?format=csv',
      {
        headers: { Accept: 'text/csv' },
        method: 'GET',
      }
    );
  });
});
