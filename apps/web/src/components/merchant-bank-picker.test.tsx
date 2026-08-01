import { fireEvent, render, screen } from '@testing-library/react';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { describe, expect, it } from 'vitest';
import { Form } from '@/components/ui/form';
import type { Bank } from '@/lib/paystack';
import type { BankFormInput } from './merchant-bank-form-types';
import { MerchantBankPicker } from './merchant-bank-picker';

const banks: Bank[] = [
  {
    active: true,
    code: '044',
    country: 'Nigeria',
    currency: 'NGN',
    gateway: null,
    id: 1,
    is_deleted: false,
    longcode: '044150149',
    name: 'Guaranty Trust Bank',
    pay_with_bank: false,
    slug: 'guaranty-trust-bank',
    type: 'nuban',
  },
];

function PickerHarness() {
  const form = useForm<BankFormInput>({ defaultValues: { bankCode: '' } });
  const [bankSearchTerm, setBankSearchTerm] = useState('');
  const [showBankSuggestions, setShowBankSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [, setVerifiedName] = useState<string | null>(null);
  const hideBankSuggestionsTimeoutRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);

  return (
    <Form {...form}>
      <MerchantBankPicker
        bankSearchTerm={bankSearchTerm}
        banks={banks}
        highlightedIndex={highlightedIndex}
        hideBankSuggestionsTimeoutRef={hideBankSuggestionsTimeoutRef}
        isLoadingBanks={false}
        setBankSearchTerm={setBankSearchTerm}
        setHighlightedIndex={setHighlightedIndex}
        setShowBankSuggestions={setShowBankSuggestions}
        setVerifiedName={setVerifiedName}
        showBankSuggestions={showBankSuggestions}
      />
    </Form>
  );
}

describe('MerchantBankPicker', () => {
  it('filters and selects a bank from the accessible listbox', () => {
    render(<PickerHarness />);

    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'Guaranty' } });
    fireEvent.click(
      screen.getByRole('option', { name: 'Guaranty Trust Bank' })
    );

    expect(input).toHaveValue('Guaranty Trust Bank');
    expect(input).toHaveAttribute('aria-expanded', 'false');
  });
});
