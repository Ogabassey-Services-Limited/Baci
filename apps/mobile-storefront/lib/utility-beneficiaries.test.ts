import { jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  filterBeneficiaries,
  getBeneficiaries,
  saveBeneficiary,
  type UtilityBeneficiary,
} from './utility-beneficiaries';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
  },
}));

const mockGetItem = jest.mocked(AsyncStorage.getItem);
const mockSetItem = jest.mocked(AsyncStorage.setItem);

const BASE: Omit<UtilityBeneficiary, 'id' | 'lastUsed'> = {
  customerId: '43901766923',
  customerName: 'OLUROTIMI ADEBANJO',
  billerId: 'EKEDC_NG',
  billerName: 'EKEDC NG',
  billItemIdentifier: 'EKEDC_PREPAID',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockSetItem.mockResolvedValue(undefined);
});

describe('getBeneficiaries', () => {
  it('returns empty array when storage is empty', async () => {
    mockGetItem.mockResolvedValue(null);
    expect(await getBeneficiaries()).toEqual([]);
  });

  it('returns parsed beneficiaries from storage', async () => {
    const stored: UtilityBeneficiary[] = [
      { ...BASE, id: 'EKEDC_NG:EKEDC_PREPAID:43901766923', lastUsed: 1000 },
    ];
    mockGetItem.mockResolvedValue(JSON.stringify(stored));
    expect(await getBeneficiaries()).toEqual(stored);
  });

  it('returns empty array on parse error', async () => {
    mockGetItem.mockResolvedValue('not-json');
    expect(await getBeneficiaries()).toEqual([]);
  });
});

describe('saveBeneficiary', () => {
  it('saves a new beneficiary with generated id and lastUsed timestamp', async () => {
    mockGetItem.mockResolvedValue(null);
    await saveBeneficiary(BASE);

    const [[, saved]] = mockSetItem.mock.calls;
    const parsed: UtilityBeneficiary[] = JSON.parse(saved as string);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].id).toBe('EKEDC_NG:EKEDC_PREPAID:43901766923');
    expect(parsed[0].customerName).toBe(BASE.customerName);
    expect(typeof parsed[0].lastUsed).toBe('number');
  });

  it('moves an existing beneficiary to the top on re-save', async () => {
    const older: UtilityBeneficiary = {
      ...BASE,
      id: 'EKEDC_NG:EKEDC_PREPAID:43901766923',
      lastUsed: 1000,
    };
    const other: UtilityBeneficiary = {
      ...BASE,
      customerId: '99999',
      id: 'EKEDC_NG:EKEDC_PREPAID:99999',
      lastUsed: 2000,
    };
    mockGetItem.mockResolvedValue(JSON.stringify([other, older]));
    await saveBeneficiary(BASE);

    const [[, saved]] = mockSetItem.mock.calls;
    const parsed: UtilityBeneficiary[] = JSON.parse(saved as string);
    expect(parsed[0].id).toBe('EKEDC_NG:EKEDC_PREPAID:43901766923');
    expect(parsed[1].id).toBe('EKEDC_NG:EKEDC_PREPAID:99999');
  });

  it('trims to MAX_BENEFICIARIES (10)', async () => {
    const existing: UtilityBeneficiary[] = Array.from(
      { length: 10 },
      (_, i) => ({
        ...BASE,
        customerId: `meter-${i}`,
        id: `EKEDC_NG:EKEDC_PREPAID:meter-${i}`,
        lastUsed: i,
      })
    );
    mockGetItem.mockResolvedValue(JSON.stringify(existing));

    await saveBeneficiary({ ...BASE, customerId: 'new-meter' });

    const [[, saved]] = mockSetItem.mock.calls;
    const parsed: UtilityBeneficiary[] = JSON.parse(saved as string);
    expect(parsed).toHaveLength(10);
    expect(parsed[0].customerId).toBe('new-meter');
  });
});

describe('filterBeneficiaries', () => {
  const list: UtilityBeneficiary[] = [
    {
      ...BASE,
      id: 'EKEDC_NG:EKEDC_PREPAID:111',
      customerId: '111',
      lastUsed: 1,
    },
    {
      ...BASE,
      id: 'EKEDC_NG:EKEDC_POSTPAID:222',
      customerId: '222',
      billItemIdentifier: 'EKEDC_POSTPAID',
      lastUsed: 2,
    },
    {
      ...BASE,
      id: 'OTHER:EKEDC_PREPAID:333',
      customerId: '333',
      billerId: 'OTHER',
      lastUsed: 3,
    },
  ];

  it('returns only beneficiaries matching billerId and billItemIdentifier', () => {
    const result = filterBeneficiaries(list, 'EKEDC_NG', 'EKEDC_PREPAID');
    expect(result).toHaveLength(1);
    expect(result[0].customerId).toBe('111');
  });

  it('returns empty array when no match', () => {
    expect(filterBeneficiaries(list, 'UNKNOWN', 'EKEDC_PREPAID')).toEqual([]);
  });
});
