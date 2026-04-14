import { describe, expect, it } from 'vitest';
import {
  billersQuerySchema,
  billTypeEnum,
  COMMISSION_CATEGORY_MAP,
  purchaseSchema,
  verifySchema,
} from './vtu';

describe('billTypeEnum', () => {
  it('parses valid bill type values', () => {
    expect(billTypeEnum.parse('airtime')).toBe('airtime');
    expect(billTypeEnum.parse('data')).toBe('data');
    expect(billTypeEnum.parse('electricity')).toBe('electricity');
    expect(billTypeEnum.parse('cable_tv')).toBe('cable_tv');
    expect(billTypeEnum.parse('betting')).toBe('betting');
  });

  it('rejects invalid bill type values', () => {
    const result = billTypeEnum.safeParse('invalid_type');
    expect(result.success).toBe(false);
  });

  it('rejects empty string', () => {
    const result = billTypeEnum.safeParse('');
    expect(result.success).toBe(false);
  });

  it('rejects null and undefined', () => {
    expect(billTypeEnum.safeParse(null).success).toBe(false);
    expect(billTypeEnum.safeParse(undefined).success).toBe(false);
  });
});

describe('purchaseSchema', () => {
  describe('airtime purchases', () => {
    it('parses valid airtime purchase with required fields', () => {
      const validAirtime = {
        merchantSlug: 'test-merchant',
        amount: 100,
        type: 'airtime' as const,
        phoneNumber: '08012345678',
        networkProvider: 'MTN',
      };

      const result = purchaseSchema.safeParse(validAirtime);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.source).toBe('direct');
      }
    });

    it('rejects airtime without phoneNumber', () => {
      const invalidAirtime = {
        merchantSlug: 'test-merchant',
        amount: 100,
        type: 'airtime' as const,
        networkProvider: 'MTN',
      };

      const result = purchaseSchema.safeParse(invalidAirtime);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('phoneNumber');
        expect(result.error.issues[0].message).toContain(
          'phoneNumber is required'
        );
      }
    });

    it('rejects airtime without networkProvider', () => {
      const invalidAirtime = {
        merchantSlug: 'test-merchant',
        amount: 100,
        type: 'airtime' as const,
        phoneNumber: '08012345678',
      };

      const result = purchaseSchema.safeParse(invalidAirtime);
      expect(result.success).toBe(false);
    });
  });

  describe('data purchases', () => {
    it('parses valid data purchase with required fields', () => {
      const validData = {
        merchantSlug: 'test-merchant',
        amount: 500,
        type: 'data' as const,
        phoneNumber: '08012345678',
        networkProvider: 'GLO',
        dataPlanCode: 'G-1GB-30D',
      };

      const result = purchaseSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('rejects data without phoneNumber and networkProvider', () => {
      const invalidData = {
        merchantSlug: 'test-merchant',
        amount: 500,
        type: 'data' as const,
        dataPlanCode: 'G-1GB-30D',
      };

      const result = purchaseSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('electricity purchases', () => {
    it('parses valid electricity purchase with required fields', () => {
      const validElectricity = {
        merchantSlug: 'test-merchant',
        amount: 5000,
        type: 'electricity' as const,
        billItemIdentifier: 'EKEDC-PREPAID',
        customerIdentifier: '1234567890',
        billerName: 'Eko Electricity',
      };

      const result = purchaseSchema.safeParse(validElectricity);
      expect(result.success).toBe(true);
    });

    it('rejects electricity without billItemIdentifier', () => {
      const invalidElectricity = {
        merchantSlug: 'test-merchant',
        amount: 5000,
        type: 'electricity' as const,
        customerIdentifier: '1234567890',
      };

      const result = purchaseSchema.safeParse(invalidElectricity);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('billItemIdentifier');
      }
    });

    it('rejects electricity without customerIdentifier', () => {
      const invalidElectricity = {
        merchantSlug: 'test-merchant',
        amount: 5000,
        type: 'electricity' as const,
        billItemIdentifier: 'EKEDC-PREPAID',
      };

      const result = purchaseSchema.safeParse(invalidElectricity);
      expect(result.success).toBe(false);
    });
  });

  describe('cable TV purchases', () => {
    it('parses valid cable TV purchase', () => {
      const validCableTv = {
        merchantSlug: 'test-merchant',
        amount: 3500,
        type: 'cable_tv' as const,
        billItemIdentifier: 'DSTV-COMPACT',
        customerIdentifier: '1234567890',
        billerName: 'DSTV',
      };

      const result = purchaseSchema.safeParse(validCableTv);
      expect(result.success).toBe(true);
    });

    it('rejects cable TV without bill identifiers', () => {
      const invalidCableTv = {
        merchantSlug: 'test-merchant',
        amount: 3500,
        type: 'cable_tv' as const,
      };

      const result = purchaseSchema.safeParse(invalidCableTv);
      expect(result.success).toBe(false);
    });
  });

  describe('betting purchases', () => {
    it('parses valid betting purchase', () => {
      const validBetting = {
        merchantSlug: 'test-merchant',
        amount: 1000,
        type: 'betting' as const,
        billItemIdentifier: 'BET9JA',
        customerIdentifier: '1234567890',
        billerName: 'Bet9ja',
      };

      const result = purchaseSchema.safeParse(validBetting);
      expect(result.success).toBe(true);
    });

    it('rejects betting without required fields', () => {
      const invalidBetting = {
        merchantSlug: 'test-merchant',
        amount: 1000,
        type: 'betting' as const,
      };

      const result = purchaseSchema.safeParse(invalidBetting);
      expect(result.success).toBe(false);
    });
  });

  describe('amount validation', () => {
    it('rejects amount below minimum (49)', () => {
      const belowMin = {
        merchantSlug: 'test-merchant',
        amount: 49,
        type: 'airtime' as const,
        phoneNumber: '08012345678',
        networkProvider: 'MTN',
      };

      const result = purchaseSchema.safeParse(belowMin);
      expect(result.success).toBe(false);
    });

    it('accepts amount at minimum (50)', () => {
      const atMin = {
        merchantSlug: 'test-merchant',
        amount: 50,
        type: 'airtime' as const,
        phoneNumber: '08012345678',
        networkProvider: 'MTN',
      };

      const result = purchaseSchema.safeParse(atMin);
      expect(result.success).toBe(true);
    });

    it('accepts amount at maximum (500000)', () => {
      const atMax = {
        merchantSlug: 'test-merchant',
        amount: 500000,
        type: 'airtime' as const,
        phoneNumber: '08012345678',
        networkProvider: 'MTN',
      };

      const result = purchaseSchema.safeParse(atMax);
      expect(result.success).toBe(true);
    });

    it('rejects amount above maximum (500001)', () => {
      const aboveMax = {
        merchantSlug: 'test-merchant',
        amount: 500001,
        type: 'airtime' as const,
        phoneNumber: '08012345678',
        networkProvider: 'MTN',
      };

      const result = purchaseSchema.safeParse(aboveMax);
      expect(result.success).toBe(false);
    });
  });

  describe('merchantSlug validation', () => {
    it('rejects empty merchantSlug', () => {
      const emptySlug = {
        merchantSlug: '',
        amount: 100,
        type: 'airtime' as const,
        phoneNumber: '08012345678',
        networkProvider: 'MTN',
      };

      const result = purchaseSchema.safeParse(emptySlug);
      expect(result.success).toBe(false);
    });

    it('rejects missing merchantSlug', () => {
      const missingSlug = {
        amount: 100,
        type: 'airtime' as const,
        phoneNumber: '08012345678',
        networkProvider: 'MTN',
      };

      const result = purchaseSchema.safeParse(missingSlug);
      expect(result.success).toBe(false);
    });
  });

  describe('source field', () => {
    it('defaults source to "direct" when not provided', () => {
      const withoutSource = {
        merchantSlug: 'test-merchant',
        amount: 100,
        type: 'airtime' as const,
        phoneNumber: '08012345678',
        networkProvider: 'MTN',
      };

      const result = purchaseSchema.safeParse(withoutSource);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.source).toBe('direct');
      }
    });

    it('accepts all valid source values', () => {
      const sources = [
        'checkout',
        'loyalty_reward',
        'direct',
        'gift',
        'storefront_modal',
      ] as const;

      for (const source of sources) {
        const withSource = {
          merchantSlug: 'test-merchant',
          amount: 100,
          type: 'airtime' as const,
          phoneNumber: '08012345678',
          networkProvider: 'MTN',
          source,
        };

        const result = purchaseSchema.safeParse(withSource);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.source).toBe(source);
        }
      }
    });

    it('rejects invalid source values', () => {
      const invalidSource = {
        merchantSlug: 'test-merchant',
        amount: 100,
        type: 'airtime' as const,
        phoneNumber: '08012345678',
        networkProvider: 'MTN',
        source: 'invalid_source',
      };

      const result = purchaseSchema.safeParse(invalidSource);
      expect(result.success).toBe(false);
    });
  });

  describe('optional fields', () => {
    it('accepts valid UUID for customerId', () => {
      const withCustomerId = {
        merchantSlug: 'test-merchant',
        amount: 100,
        type: 'airtime' as const,
        phoneNumber: '08012345678',
        networkProvider: 'MTN',
        customerId: '123e4567-e89b-12d3-a456-426614174000',
      };

      const result = purchaseSchema.safeParse(withCustomerId);
      expect(result.success).toBe(true);
    });

    it('rejects invalid UUID for customerId', () => {
      const withInvalidUuid = {
        merchantSlug: 'test-merchant',
        amount: 100,
        type: 'airtime' as const,
        phoneNumber: '08012345678',
        networkProvider: 'MTN',
        customerId: 'not-a-uuid',
      };

      const result = purchaseSchema.safeParse(withInvalidUuid);
      expect(result.success).toBe(false);
    });

    it('accepts valid UUID for orderId', () => {
      const withOrderId = {
        merchantSlug: 'test-merchant',
        amount: 100,
        type: 'airtime' as const,
        phoneNumber: '08012345678',
        networkProvider: 'MTN',
        orderId: '123e4567-e89b-12d3-a456-426614174000',
      };

      const result = purchaseSchema.safeParse(withOrderId);
      expect(result.success).toBe(true);
    });
  });
});

describe('verifySchema', () => {
  it('parses valid input with both required fields', () => {
    const validInput = {
      billItemIdentifier: 'EKEDC-PREPAID',
      customerIdentifier: '1234567890',
    };

    const result = verifySchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it('rejects empty billItemIdentifier', () => {
    const emptyBillItem = {
      billItemIdentifier: '',
      customerIdentifier: '1234567890',
    };

    const result = verifySchema.safeParse(emptyBillItem);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain(
        'Bill item identifier is required'
      );
    }
  });

  it('rejects empty customerIdentifier', () => {
    const emptyCustomer = {
      billItemIdentifier: 'EKEDC-PREPAID',
      customerIdentifier: '',
    };

    const result = verifySchema.safeParse(emptyCustomer);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain(
        'Customer identifier is required'
      );
    }
  });

  it('rejects missing billItemIdentifier', () => {
    const missingBillItem = {
      customerIdentifier: '1234567890',
    };

    const result = verifySchema.safeParse(missingBillItem);
    expect(result.success).toBe(false);
  });

  it('rejects missing customerIdentifier', () => {
    const missingCustomer = {
      billItemIdentifier: 'EKEDC-PREPAID',
    };

    const result = verifySchema.safeParse(missingCustomer);
    expect(result.success).toBe(false);
  });
});

describe('billersQuerySchema', () => {
  it('parses valid bill type', () => {
    const validQuery = { type: 'airtime' as const };
    const result = billersQuerySchema.safeParse(validQuery);
    expect(result.success).toBe(true);
  });

  it('accepts all valid bill types', () => {
    const types = ['airtime', 'data', 'electricity', 'cable_tv', 'betting'];

    for (const type of types) {
      const result = billersQuerySchema.safeParse({ type });
      expect(result.success).toBe(true);
    }
  });

  it('rejects invalid bill type', () => {
    const invalidQuery = { type: 'invalid_type' };
    const result = billersQuerySchema.safeParse(invalidQuery);
    expect(result.success).toBe(false);
  });

  it('rejects missing type field', () => {
    const missingType = {};
    const result = billersQuerySchema.safeParse(missingType);
    expect(result.success).toBe(false);
  });
});

describe('COMMISSION_CATEGORY_MAP', () => {
  it('has all 5 bill type keys', () => {
    const expectedKeys = [
      'airtime',
      'data',
      'electricity',
      'cable_tv',
      'betting',
    ];
    const actualKeys = Object.keys(COMMISSION_CATEGORY_MAP);

    expect(actualKeys).toHaveLength(5);
    for (const key of expectedKeys) {
      expect(actualKeys).toContain(key);
    }
  });

  it('maps airtime to AIRTIME', () => {
    expect(COMMISSION_CATEGORY_MAP.airtime).toBe('AIRTIME');
  });

  it('maps data to DATA', () => {
    expect(COMMISSION_CATEGORY_MAP.data).toBe('DATA');
  });

  it('maps electricity to ELECTRICITY', () => {
    expect(COMMISSION_CATEGORY_MAP.electricity).toBe('ELECTRICITY');
  });

  it('maps cable_tv to CABLE', () => {
    expect(COMMISSION_CATEGORY_MAP.cable_tv).toBe('CABLE');
  });

  it('maps betting to BETTING', () => {
    expect(COMMISSION_CATEGORY_MAP.betting).toBe('BETTING');
  });

  it('returns uppercase commission categories', () => {
    const values = Object.values(COMMISSION_CATEGORY_MAP);
    for (const value of values) {
      expect(value).toBe(value.toUpperCase());
    }
  });
});
