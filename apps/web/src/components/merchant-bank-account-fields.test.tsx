import { fireEvent, render, screen } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { describe, expect, it } from 'vitest';
import { Form } from '@/components/ui/form';
import { MerchantBankAccountFields } from './merchant-bank-account-fields';
import type { BankFormInput } from './merchant-bank-form-types';

function AccountFieldsHarness({
  isManualBankDetails,
}: {
  isManualBankDetails: boolean;
}) {
  const form = useForm<BankFormInput>({
    defaultValues: {
      accountName: '',
      accountNumber: '',
      bankCode: '',
      bankName: '',
      businessName: '',
      manualBankDetails: isManualBankDetails,
    },
  });
  return (
    <Form {...form}>
      <MerchantBankAccountFields isManualBankDetails={isManualBankDetails} />
    </Form>
  );
}

describe('MerchantBankAccountFields', () => {
  it('keeps Paystack account numbers numeric and hides manual-only fields', () => {
    render(<AccountFieldsHarness isManualBankDetails={false} />);

    const accountNumber = screen.getByLabelText('Account Number');
    fireEvent.change(accountNumber, { target: { value: '12a3' } });

    expect(accountNumber).toHaveValue('123');
    expect(screen.queryByLabelText('Bank Name')).toBeNull();
    expect(screen.queryByText(/manual invoice bank details/i)).toBeNull();
  });
});
