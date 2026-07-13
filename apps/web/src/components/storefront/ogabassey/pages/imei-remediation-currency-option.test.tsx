import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { ImeiRemediationCurrencyOption } from './imei-remediation-currency-option';

function CurrencyHarness() {
  const [currency, setCurrency] = useState<'NGN' | 'USDT'>('NGN');
  return (
    <div aria-label="Payment currency" role="radiogroup">
      <ImeiRemediationCurrencyOption
        checked={currency === 'NGN'}
        label="100,000 NGN"
        onSelect={() => setCurrency('NGN')}
        value="NGN"
      />
      <ImeiRemediationCurrencyOption
        checked={currency === 'USDT'}
        label="65.00 USDT"
        onSelect={() => setCurrency('USDT')}
        value="USDT"
      />
    </div>
  );
}

describe('ImeiRemediationCurrencyOption', () => {
  it('uses native radio keyboard behavior', async () => {
    const user = userEvent.setup();
    render(<CurrencyHarness />);
    const ngn = screen.getByRole('radio', { name: '100,000 NGN' });
    const usdt = screen.getByRole('radio', { name: '65.00 USDT' });

    expect(ngn).toBeChecked();
    await user.tab();
    await user.keyboard('{ArrowRight}');

    expect(usdt).toHaveFocus();
    expect(usdt).toBeChecked();
  });
});
