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
      isVerified: true,
      numericAmount: 5000,
      selectedBiller: BILLER,
      type: 'power',
    });

    expect(href).toBe(
      '/utilities/power?repeatAmount=5000&repeatCustomerIdentifier=43901766923&repeatBillerName=EKEDC%20NG&repeatBillItemIdentifier=ekedc-prepaid&repeatCustomerName=OLUROTIMI%20ADEBANJO&repeatCustomerAddress=12%20Adeola%20Odeku%2C%20Lagos&repeatVerified=1'
    );
  });

  it('keeps the verified flag when the biller verified WITHOUT a customer name', () => {
    // Regression (codex #4): `VerifyResult.customerName` is optional and
    // `canShowPayment` keys off the verified selection, not the name. Inferring
    // "verified" from the name dropped `repeatVerified` for a legitimately
    // verified nameless bill, so the customer returned from the wallet to a form
    // whose payment section stayed hidden until they verified all over again.
    const href = buildBillFormWalletReturnTo({
      billItemIdentifier: 'ekedc-prepaid',
      customerAddress: null,
      customerIdentifier: '43901766923',
      customerName: null,
      isVerified: true,
      numericAmount: 5000,
      selectedBiller: BILLER,
      type: 'power',
    });

    expect(href).toContain('repeatVerified=1');
    expect(href).not.toContain('repeatCustomerName');
  });

  it('omits the verified flag when the form is NOT verified, even with a name', () => {
    // The inverse guard: a stale name (e.g. from a repeat prefill the customer
    // then invalidated by editing the meter number) must not resurrect a
    // verified state the form no longer has.
    const href = buildBillFormWalletReturnTo({
      billItemIdentifier: 'ekedc-prepaid',
      customerAddress: null,
      customerIdentifier: '43901766923',
      customerName: 'OLUROTIMI ADEBANJO',
      isVerified: false,
      numericAmount: 5000,
      selectedBiller: BILLER,
      type: 'power',
    });

    expect(href).not.toContain('repeatVerified');
  });

  it('omits the verified flag and unknown fields before verification', () => {
    const href = buildBillFormWalletReturnTo({
      billItemIdentifier: null,
      customerAddress: null,
      customerIdentifier: '',
      customerName: null,
      isVerified: false,
      numericAmount: 0,
      selectedBiller: null,
      type: 'tv',
    });

    expect(href).toBe('/utilities/tv');
  });
});
