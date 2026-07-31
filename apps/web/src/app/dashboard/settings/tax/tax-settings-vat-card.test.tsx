import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TaxSettingsVatCard } from './tax-settings-vat-card';

describe('TaxSettingsVatCard', () => {
  it('shows the configured VAT rate and forwards toggle changes', () => {
    const onToggle = vi.fn();
    render(
      <TaxSettingsVatCard
        disabled={false}
        initialVatRate={7.5}
        onToggle={onToggle}
        vatEnabled={true}
      />
    );

    expect(screen.getByText('7.5%')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('switch'));
    expect(onToggle).toHaveBeenCalledWith(false);
  });
});
