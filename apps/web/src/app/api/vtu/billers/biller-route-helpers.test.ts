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
        await new Promise((resolve) => setTimeout(resolve, 1));
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

    const result = await loadMonnifyBillers({
      monnifyCategory: 'ELECTRICITY',
      type: 'electricity',
    });

    expect(result.error).toBeNull();
    expect(result.billers).toHaveLength(9);
    expect(maxActiveLookups).toBeLessThanOrEqual(4);
  });
});
