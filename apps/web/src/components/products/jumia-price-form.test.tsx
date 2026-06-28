import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useMerchantSafe } from '@/hooks/use-merchant-client';
import { JumiaPriceForm } from './jumia-price-form';

vi.mock('@/hooks/use-merchant-client', () => ({
  useMerchantSafe: vi.fn(),
}));

vi.mock('@/components/themed/themed-input', async () => {
  const { forwardRef } = await import('react');
  return {
    ThemedInput: forwardRef<
      HTMLInputElement,
      React.InputHTMLAttributes<HTMLInputElement> & { id?: string }
    >((props, ref) => <input ref={ref} {...props} />),
  };
});

vi.mock('@/components/ui/alert', () => ({
  Alert: ({
    children,
    variant,
  }: {
    children: React.ReactNode;
    variant?: string;
    className?: string;
  }) => (
    <div role="alert" data-variant={variant}>
      {children}
    </div>
  ),
  AlertTitle: ({ children }: { children: React.ReactNode }) => (
    <strong>{children}</strong>
  ),
  AlertDescription: ({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  ),
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({
    children,
    htmlFor,
  }: {
    children: React.ReactNode;
    htmlFor?: string;
    className?: string;
  }) => <label htmlFor={htmlFor}>{children}</label>,
}));

vi.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

function createOverrides(
  overrides?: Partial<{
    price: string;
    salePrice: string;
    saleStart: string;
    saleEnd: string;
    isActive: boolean;
    syncInventory: boolean;
    syncPrice: boolean;
  }>
) {
  return {
    price: '',
    salePrice: '',
    saleStart: '',
    saleEnd: '',
    isActive: true,
    syncInventory: false,
    syncPrice: false,
    ...overrides,
  };
}

describe('JumiaPriceForm', () => {
  beforeEach(() => {
    vi.mocked(useMerchantSafe).mockReturnValue({
      merchant: { country: 'NG' },
    } as unknown as ReturnType<typeof useMerchantSafe>);
  });

  it('renders price inputs with currency symbol', () => {
    render(
      <JumiaPriceForm
        overrides={createOverrides()}
        setOverrides={vi.fn()}
        basePrice={5000}
      />
    );

    expect(screen.getByLabelText('Jumia Base Price')).toBeInTheDocument();
    expect(
      screen.getByLabelText('Jumia Sale Price (Optional)')
    ).toBeInTheDocument();
    // Naira symbol is rendered
    expect(screen.getAllByText('\u20A6').length).toBeGreaterThanOrEqual(1);
  });

  it('renders price inputs with default USD currency symbol when country is unknown', () => {
    vi.mocked(useMerchantSafe).mockReturnValue({
      merchant: { country: 'US' },
    } as unknown as ReturnType<typeof useMerchantSafe>);

    render(
      <JumiaPriceForm
        overrides={createOverrides()}
        setOverrides={vi.fn()}
        basePrice={5000}
      />
    );

    expect(screen.getByLabelText('Jumia Base Price')).toBeInTheDocument();
    expect(
      screen.getByLabelText('Jumia Sale Price (Optional)')
    ).toBeInTheDocument();
    // Dollar symbol is rendered
    expect(screen.getAllByText('$').length).toBeGreaterThanOrEqual(1);
  });

  it('renders sale date inputs', () => {
    render(
      <JumiaPriceForm
        overrides={createOverrides()}
        setOverrides={vi.fn()}
        basePrice={5000}
      />
    );

    expect(screen.getByLabelText('Sale Start')).toBeInTheDocument();
    expect(screen.getByLabelText('Sale End')).toBeInTheDocument();
  });

  it('shows low price warning when jumia price is 80% below base', async () => {
    const setOverrides = vi.fn();
    render(
      <JumiaPriceForm
        overrides={createOverrides({ price: '3000', isActive: true })}
        setOverrides={setOverrides}
        basePrice={5000}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Low Price Warning')).toBeInTheDocument();
    });
  });

  it('does not show low price warning when price is within range', () => {
    render(
      <JumiaPriceForm
        overrides={createOverrides({ price: '4500', isActive: true })}
        setOverrides={vi.fn()}
        basePrice={5000}
      />
    );

    expect(screen.queryByText('Low Price Warning')).not.toBeInTheDocument();
  });

  it('does not show low price warning when listing is inactive', () => {
    render(
      <JumiaPriceForm
        overrides={createOverrides({ price: '1000', isActive: false })}
        setOverrides={vi.fn()}
        basePrice={5000}
      />
    );

    expect(screen.queryByText('Low Price Warning')).not.toBeInTheDocument();
  });

  it('uses base price as placeholder text', () => {
    render(
      <JumiaPriceForm
        overrides={createOverrides()}
        setOverrides={vi.fn()}
        basePrice={7500}
      />
    );

    expect(screen.getByPlaceholderText('7500')).toBeInTheDocument();
  });

  it('calls setOverrides when price input changes', async () => {
    const user = userEvent.setup();
    const setOverrides = vi.fn();
    render(
      <JumiaPriceForm
        overrides={createOverrides()}
        setOverrides={setOverrides}
        basePrice={5000}
      />
    );

    const priceInput = screen.getByLabelText('Jumia Base Price');
    await user.type(priceInput, '4000');

    await waitFor(() => {
      expect(setOverrides).toHaveBeenCalled();
    });
  });

  it('displays helper text for empty price field', () => {
    render(
      <JumiaPriceForm
        overrides={createOverrides()}
        setOverrides={vi.fn()}
        basePrice={5000}
      />
    );

    expect(
      screen.getByText('Leave empty to follow Baci base price')
    ).toBeInTheDocument();
  });
});
