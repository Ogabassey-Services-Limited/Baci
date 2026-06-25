import type { Biller, BillItem } from '@/hooks/use-vtu-billers';
import { createBillFormVerifyPayload } from './bill-form-verify-payload';

const baseBiller: Biller = {
  billerId: 'ikedc',
  billerName: 'Ikeja Electric',
  billerType: 'electricity',
  categoryId: 'electricity',
  categoryName: 'Electricity',
};

describe('createBillFormVerifyPayload', () => {
  it('defaults to Kuda payload fields when provider metadata is absent', () => {
    expect(
      createBillFormVerifyPayload({
        customerIdentifier: '43901766923',
        selectedBiller: baseBiller,
        selectedBillItem: null,
        selectedBillItemIdentifier: 'prepaid',
      })
    ).toEqual({
      billItemIdentifier: 'prepaid',
      billerCode: undefined,
      customerIdentifier: '43901766923',
      productCode: undefined,
      provider: 'kuda',
    });
  });

  it('preserves Monnify provider-specific verify fields', () => {
    const selectedBillItem: BillItem = {
      amount: 0,
      billerCode: 'IKEDC',
      isAmountFixed: false,
      itemCode: 'IKEDC_PREPAID',
      itemCurrencySymbol: 'NGN',
      itemFee: 0,
      itemName: 'Prepaid',
      productCode: 'IKEDC_PREPAID',
      provider: 'monnify',
    };

    expect(
      createBillFormVerifyPayload({
        customerIdentifier: '43901766923',
        selectedBiller: { ...baseBiller, billerCode: 'IKEDC' },
        selectedBillItem,
        selectedBillItemIdentifier: 'IKEDC_PREPAID',
      })
    ).toEqual({
      billItemIdentifier: 'IKEDC_PREPAID',
      billerCode: 'IKEDC',
      customerIdentifier: '43901766923',
      productCode: 'IKEDC_PREPAID',
      provider: 'monnify',
    });
  });

  it('routes folded Kuda electricity items through Monnify verify codes', () => {
    const selectedBillItem: BillItem = {
      amount: 0,
      isAmountFixed: false,
      itemCode: 'KUD-ELE-IKEDC-PREPAID',
      itemCurrencySymbol: 'NGN',
      itemFee: 0,
      itemName: 'Prepaid meter',
      monnifyBillerCode: 'IKEDC',
      monnifyProductCode: 'IKEDC_PREPAID',
      provider: 'kuda',
    };

    expect(
      createBillFormVerifyPayload({
        customerIdentifier: '43901766923',
        selectedBiller: baseBiller,
        selectedBillItem,
        selectedBillItemIdentifier: 'KUD-ELE-IKEDC-PREPAID',
      })
    ).toEqual({
      billItemIdentifier: 'KUD-ELE-IKEDC-PREPAID',
      billerCode: 'IKEDC',
      customerIdentifier: '43901766923',
      productCode: 'IKEDC_PREPAID',
      provider: 'monnify',
    });
  });

  it('uses biller-level billerCode when there is no selected item', () => {
    expect(
      createBillFormVerifyPayload({
        customerIdentifier: '43901766923',
        selectedBiller: { ...baseBiller, billerCode: 'IKEDC' },
        selectedBillItem: null,
        selectedBillItemIdentifier: 'prepaid',
      })
    ).toEqual({
      billItemIdentifier: 'prepaid',
      billerCode: 'IKEDC',
      customerIdentifier: '43901766923',
      productCode: undefined,
      provider: 'kuda',
    });
  });

  it('uses biller-level provider to derive Monnify product code', () => {
    expect(
      createBillFormVerifyPayload({
        customerIdentifier: '43901766923',
        selectedBiller: {
          ...baseBiller,
          billerCode: 'IKEDC',
          provider: 'monnify',
        },
        selectedBillItem: null,
        selectedBillItemIdentifier: 'IKEDC_PREPAID',
      })
    ).toEqual({
      billItemIdentifier: 'IKEDC_PREPAID',
      billerCode: 'IKEDC',
      customerIdentifier: '43901766923',
      productCode: 'IKEDC_PREPAID',
      provider: 'monnify',
    });
  });
});
