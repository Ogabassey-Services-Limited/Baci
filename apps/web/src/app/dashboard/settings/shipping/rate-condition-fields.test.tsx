import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RateConditionFields } from './rate-condition-fields';

Object.defineProperty(HTMLElement.prototype, 'hasPointerCapture', {
  configurable: true,
  value: () => false,
});
Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
  configurable: true,
  value: () => undefined,
});

type RateConditionFieldsProps = Parameters<typeof RateConditionFields>[0];

function renderFields(overrides: Partial<RateConditionFieldsProps> = {}) {
  const props: RateConditionFieldsProps = {
    conditionType: 'always',
    onConditionTypeChange: vi.fn(),
    minSubtotal: '',
    onMinSubtotalChange: vi.fn(),
    maxSubtotal: '',
    onMaxSubtotalChange: vi.fn(),
    currencySymbol: '₦',
    ...overrides,
  };
  render(<RateConditionFields {...props} />);
  return props;
}

describe('RateConditionFields', () => {
  it('hides the subtotal range inputs when the condition is "always"', () => {
    renderFields({ conditionType: 'always' });

    expect(screen.queryByLabelText(/min subtotal/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/max subtotal/i)).not.toBeInTheDocument();
  });

  it('shows the subtotal range inputs with the currency symbol when tiered', () => {
    renderFields({
      conditionType: 'price_tier',
      minSubtotal: '100',
      maxSubtotal: '500',
    });

    expect(screen.getByLabelText(/min subtotal \(₦\)/i)).toHaveValue(100);
    expect(screen.getByLabelText(/max subtotal \(₦\)/i)).toHaveValue(500);
  });

  it('reports subtotal edits through the change callbacks', () => {
    const props = renderFields({ conditionType: 'price_tier' });

    fireEvent.change(screen.getByLabelText(/min subtotal/i), {
      target: { value: '250' },
    });
    fireEvent.change(screen.getByLabelText(/max subtotal/i), {
      target: { value: '750' },
    });

    expect(props.onMinSubtotalChange).toHaveBeenCalledWith('250');
    expect(props.onMaxSubtotalChange).toHaveBeenCalledWith('750');
  });

  it('switches to price-tier mode when the range option is selected', async () => {
    const user = userEvent.setup();
    const props = renderFields({ conditionType: 'always' });

    await user.click(screen.getByRole('combobox'));
    await user.click(
      await screen.findByRole('option', { name: /order subtotal range/i })
    );

    expect(props.onConditionTypeChange).toHaveBeenCalledWith('price_tier');
  });
});
