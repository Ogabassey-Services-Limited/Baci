import { jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  filterBeneficiaries,
  getBeneficiaries,
  saveBeneficiary,
  type UtilityBeneficiary,
} from '@/lib/utility-beneficiaries';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
  },
}));

const mockGetItem = AsyncStorage.getItem as jest.MockedFunction<
  typeof AsyncStorage.getItem
>;
const mockSetItem = AsyncStorage.setItem as jest.MockedFunction<
  typeof AsyncStorage.setItem
>;

const BASE_INPUT: Omit<UtilityBeneficiary, 'id' | 'lastUsed'> = {
  billerId: 'EKEDC_NG',
  billerName: 'EKEDC NG',
  billItemIdentifier: 'EKEDC_PREPAID',
  customerId: '43901766923',
  customerName: 'OLUROTIMI ADEBANJO',
};

describe('getBeneficiaries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns an empty array when storage is empty', async () => {
    mockGetItem.mockResolvedValue(null);
    const result = await getBeneficiaries();
    expect(result).toEqual([]);
  });

  it('returns an empty array when storage value is invalid JSON', async () => {
    mockGetItem.mockResolvedValue('not-json');
    const result = await getBeneficiaries();
    expect(result).toEqual([]);
  });

  it('filters out invalid entries from storage', async () => {
    const valid: UtilityBeneficiary = {
      id: 'EKEDC_NG:EKEDC_PREPAID:43901766923',
      customerId: '43901766923',
      customerName: 'OLUROTIMI ADEBANJO',
      billerId: 'EKEDC_NG',
      billerName: 'EKEDC NG',
      billItemIdentifier: 'EKEDC_PREPAID',
      lastUsed: 1000,
    };
    mockGetItem.mockResolvedValue(
      JSON.stringify([valid, { id: 'bad', missing: 'fields' }])
    );
    const result = await getBeneficiaries();
    expect(result).toEqual([valid]);
  });

  it('returns parsed beneficiaries from storage', async () => {
    const stored: UtilityBeneficiary[] = [
      {
        id: 'EKEDC_NG:EKEDC_PREPAID:43901766923',
        customerId: '43901766923',
        customerName: 'OLUROTIMI ADEBANJO',
        billerId: 'EKEDC_NG',
        billerName: 'EKEDC NG',
        billItemIdentifier: 'EKEDC_PREPAID',
        lastUsed: 1000,
      },
    ];
    mockGetItem.mockResolvedValue(JSON.stringify(stored));
    const result = await getBeneficiaries();
    expect(result).toEqual(stored);
  });
});

describe('saveBeneficiary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetItem.mockResolvedValue(null);
    mockSetItem.mockResolvedValue(undefined);
  });

  it('saves a new beneficiary with a collision-safe encoded ID', async () => {
    await saveBeneficiary(BASE_INPUT);

    expect(mockSetItem).toHaveBeenCalledTimes(1);
    const [, json] = mockSetItem.mock.calls[0] as [string, string];
    const saved = JSON.parse(json) as UtilityBeneficiary[];
    expect(saved).toHaveLength(1);
    expect(saved[0]?.id).toBe('EKEDC_NG:EKEDC_PREPAID:43901766923');
    expect(saved[0]?.customerId).toBe('43901766923');
  });

  it('moves an existing beneficiary to the front when re-saved', async () => {
    const existing: UtilityBeneficiary[] = [
      {
        id: 'EKEDC_NG:EKEDC_PREPAID:43901766923',
        customerId: '43901766923',
        customerName: 'OLUROTIMI ADEBANJO',
        billerId: 'EKEDC_NG',
        billerName: 'EKEDC NG',
        billItemIdentifier: 'EKEDC_PREPAID',
        lastUsed: 1000,
      },
      {
        id: 'EKEDC_NG:EKEDC_PREPAID:43901577981',
        customerId: '43901577981',
        customerName: 'OLADIMEJI OLUROTIMI',
        billerId: 'EKEDC_NG',
        billerName: 'EKEDC NG',
        billItemIdentifier: 'EKEDC_PREPAID',
        lastUsed: 900,
      },
    ];
    mockGetItem.mockResolvedValue(JSON.stringify(existing));

    await saveBeneficiary({ ...BASE_INPUT, customerId: '43901577981', customerName: 'OLADIMEJI OLUROTIMI' });

    const [, json] = mockSetItem.mock.calls[0] as [string, string];
    const saved = JSON.parse(json) as UtilityBeneficiary[];
    expect(saved[0]?.customerId).toBe('43901577981');
    expect(saved).toHaveLength(2);
  });

  it('respects MAX_BENEFICIARIES limit', async () => {
    const existing: UtilityBeneficiary[] = Array.from({ length: 10 }, (_, i) => ({
      id: `EKEDC_NG:EKEDC_PREPAID:meter${i}`,
      customerId: `meter${i}`,
      customerName: `Customer ${i}`,
      billerId: 'EKEDC_NG',
      billerName: 'EKEDC NG',
      billItemIdentifier: 'EKEDC_PREPAID',
      lastUsed: i,
    }));
    mockGetItem.mockResolvedValue(JSON.stringify(existing));

    await saveBeneficiary({ ...BASE_INPUT, customerId: 'meterNEW', customerName: 'New Customer' });

    const [, json] = mockSetItem.mock.calls[0] as [string, string];
    const saved = JSON.parse(json) as UtilityBeneficiary[];
    expect(saved).toHaveLength(10);
    expect(saved[0]?.customerId).toBe('meterNEW');
  });
});

describe('filterBeneficiaries', () => {
  const beneficiaries: UtilityBeneficiary[] = [
    {
      id: 'EKEDC_NG:EKEDC_PREPAID:43901766923',
      customerId: '43901766923',
      customerName: 'OLUROTIMI ADEBANJO',
      billerId: 'EKEDC_NG',
      billerName: 'EKEDC NG',
      billItemIdentifier: 'EKEDC_PREPAID',
      lastUsed: 1000,
    },
    {
      id: 'IKEDC:IKEDC_PREPAID:99999999999',
      customerId: '99999999999',
      customerName: 'OTHER CUSTOMER',
      billerId: 'IKEDC',
      billerName: 'IKEDC',
      billItemIdentifier: 'IKEDC_PREPAID',
      lastUsed: 2000,
    },
  ];

  it('returns only beneficiaries matching the biller and bill item', () => {
    const result = filterBeneficiaries(beneficiaries, 'EKEDC_NG', 'EKEDC_PREPAID');
    expect(result).toHaveLength(1);
    expect(result[0]?.customerId).toBe('43901766923');
  });

  it('returns an empty array when no beneficiaries match', () => {
    const result = filterBeneficiaries(beneficiaries, 'UNKNOWN', 'UNKNOWN_ITEM');
    expect(result).toEqual([]);
  });
});
