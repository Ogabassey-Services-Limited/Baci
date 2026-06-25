import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadKudaBillers, loadMonnifyBillers } from './biller-route-helpers';

const mockGetBillersByCategory = vi.fn();
const mockGetMonnifyBillers = vi.fn();
const mockGetMonnifyBillerProducts = vi.fn();

vi.mock('@/lib/kuda-bills', () => ({
  getBillersByCategory: (...args: unknown[]) =>
    mockGetBillersByCategory(...args),
}));

vi.mock('@/lib/monnify-bills', () => ({
  getBillerProducts: (...args: unknown[]) =>
    mockGetMonnifyBillerProducts(...args),
  getBillers: (...args: unknown[]) => mockGetMonnifyBillers(...args),
}));

describe('biller route helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('loads validated Kuda billers with normalized item provider metadata', async () => {
    mockGetBillersByCategory.mockResolvedValue([
      {
        billItems: [
          {
            amount: 0,
            isAmountFixed: false,
            itemCode: 'prepaid',
            itemCurrencySymbol: 'NGN',
            itemFee: 0,
            itemName: 'Prepaid',
          },
        ],
        billerId: 'IKEDC',
        billerName: 'Ikeja Electric',
        billerType: 'electricity',
        categoryId: 'electricity',
        categoryName: 'Electricity',
      },
    ]);

    const result = await loadKudaBillers('electricity');

    expect(result.error).toBeNull();
    expect(result.billers).toEqual([
      {
        billItems: [
          {
            amount: 0,
            isAmountFixed: false,
            itemCode: 'prepaid',
            itemCurrencySymbol: 'NGN',
            itemFee: 0,
            itemName: 'Prepaid',
            provider: 'kuda',
          },
        ],
        billerId: 'IKEDC',
        billerName: 'Ikeja Electric',
        billerType: 'electricity',
        categoryId: 'electricity',
        categoryName: 'Electricity',
        provider: 'kuda',
      },
    ]);
    expect(mockGetBillersByCategory).toHaveBeenCalledWith('electricity');
  });

  it('forwards the Kuda-supplied biller logo (billerIconUrl)', async () => {
    mockGetBillersByCategory.mockResolvedValue([
      {
        billerIconUrl: 'https://cdn.kuda.com/billers/ikedc.png',
        billerId: 'IKEDC',
        billerName: 'Ikeja Electric',
        billerType: 'electricity',
        categoryId: 'electricity',
        categoryName: 'Electricity',
      },
    ]);

    const result = await loadKudaBillers('electricity');

    expect(result.error).toBeNull();
    expect(result.billers[0]?.billerIconUrl).toBe(
      'https://cdn.kuda.com/billers/ikedc.png'
    );
  });

  it('returns a Kuda validation error for invalid biller payloads', async () => {
    mockGetBillersByCategory.mockResolvedValue([
      {
        billerId: 'IKEDC',
        billerName: 'Ikeja Electric',
      },
    ]);

    const result = await loadKudaBillers('electricity');

    expect(result.billers).toEqual([]);
    expect(result.error?.message).toBe('Kuda biller payload failed validation');
  });

  it('returns the Monnify timeout error when discovery exceeds the route budget', async () => {
    vi.useFakeTimers();
    mockGetMonnifyBillers.mockReturnValue(new Promise(() => undefined));

    const resultPromise = loadMonnifyBillers({
      monnifyCategory: 'ELECTRICITY',
      type: 'electricity',
    });

    await vi.advanceTimersByTimeAsync(3_500);
    const result = await resultPromise;

    expect(result.billers).toEqual([]);
    expect(result.error?.message).toBe(
      'Monnify biller discovery exceeded route budget'
    );
  });

  it('captures invalid Monnify products and product fetch failures', async () => {
    mockGetMonnifyBillers.mockResolvedValue([
      {
        billerCategoryCode: 'ELECTRICITY',
        billerCode: 'IKEDC',
        description: 'Ikeja Electricity Distribution Company',
        name: 'Ikeja Electricity Distribution Company',
      },
      {
        billerCategoryCode: 'ELECTRICITY',
        billerCode: 'EKEDC',
        description: 'Eko Electricity Distribution Company',
        name: 'Eko Electricity Distribution Company',
      },
    ]);
    mockGetMonnifyBillerProducts.mockImplementation((billerCode: string) => {
      if (billerCode === 'IKEDC') {
        return Promise.resolve([{ productCode: 'IKEDC_PREPAID' }]);
      }
      return Promise.reject(new Error('Products unavailable'));
    });

    const result = await loadMonnifyBillers({
      monnifyCategory: 'ELECTRICITY',
      type: 'electricity',
    });

    expect(result.billers).toEqual([]);
    expect(result.error?.message).toBe(
      'Monnify products failed validation for IKEDC'
    );
    expect(mockGetMonnifyBillerProducts).toHaveBeenCalledTimes(2);
  });

  it('keeps Monnify product lookups within the concurrency budget', async () => {
    type ProductLookupGate = {
      resolve: () => void;
    };

    const lookupGates: ProductLookupGate[] = [];
    const maxGatePollingAttempts = 25;
    const waitForLookupGates = async (expectedCount: number) => {
      for (let attempt = 0; attempt < maxGatePollingAttempts; attempt += 1) {
        if (lookupGates.length >= expectedCount) {
          break;
        }
        await Promise.resolve();
      }
      expect(lookupGates).toHaveLength(expectedCount);
    };

    const billers = Array.from({ length: 9 }, (_, index) => ({
      billerCategoryCode: 'ELECTRICITY',
      billerCode: `BILLER_${index}`,
      description: `Biller ${index}`,
      name: `Biller ${index}`,
    }));
    let activeLookups = 0;
    let maxActiveLookups = 0;

    mockGetMonnifyBillers.mockResolvedValue(billers);
    mockGetMonnifyBillerProducts.mockImplementation(
      async (billerCode: string) => {
        activeLookups += 1;
        maxActiveLookups = Math.max(maxActiveLookups, activeLookups);
        await new Promise<void>((resolve) => {
          lookupGates.push({ resolve });
        });
        activeLookups -= 1;

        return [
          {
            amount: 0,
            billerCode,
            fee: 0,
            isAmountFixed: false,
            name: `${billerCode} prepaid`,
            productCode: `${billerCode}_PREPAID`,
          },
        ];
      }
    );

    const resultPromise = loadMonnifyBillers({
      monnifyCategory: 'ELECTRICITY',
      type: 'electricity',
    });

    let releasedLookups = 0;
    // Release gates in stages so each batch starts only after the prior batch
    // reaches the concurrency budget.
    for (const expectedGateCount of [4, 8, 9]) {
      await waitForLookupGates(expectedGateCount);
      for (const gate of lookupGates.slice(
        releasedLookups,
        expectedGateCount
      )) {
        gate.resolve();
      }
      releasedLookups = expectedGateCount;
      await Promise.resolve();
    }

    const result = await resultPromise;

    expect(result.error).toBeNull();
    expect(result.billers).toHaveLength(9);
    expect(maxActiveLookups).toBeLessThanOrEqual(4);
  });

  it('filters current Monnify billers and products to the requested category', async () => {
    mockGetMonnifyBillers.mockResolvedValue([
      {
        billerCode: 'MTN',
        categoryCodes: ['AIRTIME', 'DATA_BUNDLE'],
        description: 'MTN',
        name: 'MTN',
        billerCategoryCode: 'AIRTIME',
      },
      {
        billerCode: 'IKEDC',
        categoryCodes: ['ELECTRICITY'],
        description: 'Ikeja Electricity',
        name: 'Ikeja Electricity',
        billerCategoryCode: 'ELECTRICITY',
      },
    ]);
    mockGetMonnifyBillerProducts.mockResolvedValue([
      {
        amount: null,
        billerCode: 'GLO',
        categoryCode: 'AIRTIME',
        fee: null,
        isAmountFixed: false,
        maxAmount: null,
        minAmount: 100,
        name: 'Glo Mobile Top up',
        productCode: '12',
      },
      {
        amount: null,
        billerCode: 'MTN',
        categoryCode: 'AIRTIME',
        fee: null,
        isAmountFixed: false,
        maxAmount: null,
        minAmount: 100,
        name: 'MTN Mobile Top up',
        productCode: '13',
      },
      {
        amount: 500,
        billerCode: 'MTN',
        categoryCode: 'DATA_BUNDLE',
        fee: null,
        isAmountFixed: true,
        maxAmount: null,
        minAmount: null,
        name: 'MTN Data',
        productCode: '1811',
      },
    ]);

    const result = await loadMonnifyBillers({
      monnifyCategory: 'AIRTIME',
      type: 'airtime',
    });

    expect(result.error).toBeNull();
    expect(result.billers).toHaveLength(1);
    expect(result.billers[0]).toEqual(
      expect.objectContaining({
        billerCode: 'MTN',
        billerId: 'MTN',
        provider: 'monnify',
      })
    );
    expect(result.billers[0]?.billItems).toEqual([
      expect.objectContaining({
        itemCode: '13',
        productCode: '13',
        provider: 'monnify',
      }),
    ]);
    expect(mockGetMonnifyBillerProducts).toHaveBeenCalledTimes(1);
  });
});
