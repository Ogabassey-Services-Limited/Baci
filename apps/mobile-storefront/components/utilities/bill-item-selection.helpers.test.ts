import type { UtilityBeneficiary } from '@/lib/utility-beneficiaries';
import type { UtilityRepeatRecipient } from '@/lib/utility-repeat';
import {
  getBillRecipientKey,
  getVerifyErrorMessage,
  getVisibleBillBeneficiaries,
} from './bill-item-selection.helpers';

describe('bill-item-selection.helpers', () => {
  it('extracts readable messages from supported error values', () => {
    expect(getVerifyErrorMessage(undefined)).toBeUndefined();
    expect(getVerifyErrorMessage(null)).toBeUndefined();
    expect(getVerifyErrorMessage('bad input')).toBe('bad input');
    expect(getVerifyErrorMessage(new Error('network down'))).toBe(
      'network down'
    );
    expect(
      getVerifyErrorMessage({ message: 'meter not found' } as unknown)
    ).toBe('meter not found');
    expect(getVerifyErrorMessage(404)).toBe('404');
    expect(getVerifyErrorMessage([])).toBe('');
    expect(getVerifyErrorMessage({})).toBe('[object Object]');
  });

  it('builds recipient keys only when bill item and customer id exist', () => {
    expect(getBillRecipientKey(' EKEDC_PREPAID ', ' 43901766923 ')).toBe(
      'EKEDC_PREPAID:43901766923'
    );
    expect(getBillRecipientKey('', '43901766923')).toBeNull();
    expect(getBillRecipientKey('EKEDC_PREPAID', '')).toBeNull();
    expect(getBillRecipientKey(undefined, '43901766923')).toBeNull();
    expect(getBillRecipientKey('EKEDC_PREPAID', undefined)).toBeNull();
    expect(getBillRecipientKey('   ', '43901766923')).toBeNull();
    expect(getBillRecipientKey('EKEDC_PREPAID', '   ')).toBeNull();
  });

  it('filters beneficiaries already present in recent recipients', () => {
    const beneficiaries: UtilityBeneficiary[] = [
      {
        id: 'EKEDC_NG:EKEDC_PREPAID:43901766923',
        customerId: '43901766923',
        customerName: 'Jane Customer',
        billerId: 'EKEDC_NG',
        billerName: 'EKEDC NG',
        billItemIdentifier: 'EKEDC_PREPAID',
        lastUsed: 1000,
      },
      {
        id: 'EKEDC_NG:EKEDC_POSTPAID:43901766923',
        customerId: '43901766923',
        customerName: 'Postpaid Customer',
        billerId: 'EKEDC_NG',
        billerName: 'EKEDC NG',
        billItemIdentifier: 'EKEDC_POSTPAID',
        lastUsed: 999,
      },
    ];
    const recentRecipients: UtilityRepeatRecipient[] = [
      {
        id: 'recent-1',
        title: 'JANE CUSTOMER',
        identifierLabel: 'Meter Number',
        identifier: '43901766923',
        meta: '₦2,500',
        defaults: {
          amount: '2500',
          billerName: 'EKEDC NG',
          billItemIdentifier: 'EKEDC_PREPAID',
          customerIdentifier: '43901766923',
          customerName: 'JANE CUSTOMER',
          isVerified: true,
        },
      },
    ];

    expect(
      getVisibleBillBeneficiaries(beneficiaries, recentRecipients).map(
        (beneficiary) => beneficiary.id
      )
    ).toEqual(['EKEDC_NG:EKEDC_POSTPAID:43901766923']);
  });

  it('handles empty beneficiary/recent-recipient arrays', () => {
    const beneficiary: UtilityBeneficiary = {
      id: 'EKEDC_NG:EKEDC_PREPAID:43901766923',
      customerId: '43901766923',
      customerName: 'Jane Customer',
      billerId: 'EKEDC_NG',
      billerName: 'EKEDC NG',
      billItemIdentifier: 'EKEDC_PREPAID',
      lastUsed: 1000,
    };

    expect(getVisibleBillBeneficiaries([], [])).toEqual([]);
    expect(getVisibleBillBeneficiaries([beneficiary], [])).toEqual([
      beneficiary,
    ]);
  });

  it('keeps beneficiaries with missing recipient keys visible', () => {
    const beneficiaries: UtilityBeneficiary[] = [
      {
        id: 'missing-customer',
        customerId: '',
        customerName: 'No Customer',
        billerId: 'EKEDC_NG',
        billerName: 'EKEDC NG',
        billItemIdentifier: 'EKEDC_PREPAID',
        lastUsed: 1000,
      },
      {
        id: 'missing-bill-item',
        customerId: '43901766923',
        customerName: 'No Bill Item',
        billerId: 'EKEDC_NG',
        billerName: 'EKEDC NG',
        billItemIdentifier: '',
        lastUsed: 999,
      },
    ];
    const recentRecipients: UtilityRepeatRecipient[] = [
      {
        id: 'recent-1',
        title: 'JANE CUSTOMER',
        identifierLabel: 'Meter Number',
        identifier: '43901766923',
        meta: '₦2,500',
        defaults: {
          billItemIdentifier: 'EKEDC_PREPAID',
          customerIdentifier: '43901766923',
        },
      },
    ];

    expect(
      getVisibleBillBeneficiaries(beneficiaries, recentRecipients)
    ).toEqual(beneficiaries);
  });
});
