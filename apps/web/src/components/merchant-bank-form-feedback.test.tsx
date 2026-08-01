import { render, screen } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { describe, expect, it } from 'vitest';
import { Form } from '@/components/ui/form';
import { MerchantBankFormFeedback } from './merchant-bank-form-feedback';
import type { BankFormInput } from './merchant-bank-form-types';

function FeedbackHarness() {
  const form = useForm<BankFormInput>({
    defaultValues: { autoPayoutEnabled: true },
  });
  return (
    <Form {...form}>
      <MerchantBankFormFeedback
        autoPayoutEnabled
        hasHydratedAutoPayoutSetting
        isPaystackSupported
        isSubmitting={false}
        isVerifying={false}
        verificationError={null}
        verifiedName="Jane Doe"
      />
    </Form>
  );
}

describe('MerchantBankFormFeedback', () => {
  it('renders verified payment controls and a ready save action', () => {
    render(<FeedbackHarness />);

    expect(screen.getByText('Account Verified')).toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', { name: 'Automatic Settlements' })
    ).toBeChecked();
    expect(
      screen.getByRole('button', { name: /save bank details/i })
    ).toBeEnabled();
    expect(screen.getByRole('status')).toHaveTextContent('');
  });
});
