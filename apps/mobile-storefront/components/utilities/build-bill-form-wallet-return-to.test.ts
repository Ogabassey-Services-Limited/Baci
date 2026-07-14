import { describe, expect, it } from '@jest/globals';
import type { Biller } from '@/hooks/use-vtu-billers';
import { buildBillFormWalletReturnTo } from './build-bill-form-wallet-return-to';

const BILLER: Biller = {
  billerId: 'ekedc',
  billerName: 'EKEDC NG',
  billerType: 'Electricity',
  categoryId: 'electricity',
  categoryName: 'Electricity',
  billItems: [],
};

describe('buildBillFormWalletReturnTo', () => {
  it('prefills every repeat param for a verified power bill', () => {
    const href = buildBillFormWalletReturnTo({
      billItemIdentifier: 'ekedc-prepaid',
      customerAddress: '12 Adeola Odeku, Lagos',
      customerIdentifier: '43901766923',
      customerName: 'OLUROTIMI ADEBANJO',
      numericAmount: 5000,
      selectedBiller: BILLER,
      type: 'power',
    });

    expect(href).toBe(
      '/utilities/power?repeatAmount=5000&repeatCustomerIdentifier=43901766923&repeatBillerName=EKEDC%20NG&repeatBillItemIdentifier=ekedc-prepaid&repeatCustomerName=OLUROTIMI%20ADEBANJO&repeatCustomerAddress=12%20Adeola%20Odeku%2C%20Lagos&repeatVerified=1'
    );
  });

  it('omits the verified flag and unknown fields before verification', () => {
    const href = buildBillFormWalletReturnTo({
      billItemIdentifier: null,
      customerAddress: null,
      customerIdentifier: '',
      customerName: null,
      numericAmount: 0,
      selectedBiller: null,
      type: 'tv',
    });

    expect(href).toBe('/utilities/tv');
  });
});
