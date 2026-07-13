import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ImeiCheckerBrandChips } from './imei-checker-brand-chips';

describe('ImeiCheckerBrandChips', () => {
  it('renders exactly the six brand chips with no "All" option', () => {
    render(
      <ImeiCheckerBrandChips onSelectBrand={vi.fn()} selectedBrand="apple" />
    );

    for (const label of [
      'Apple',
      'Samsung',
      'Xiaomi',
      'Google',
      'Oppo',
      'Tecno',
    ]) {
      expect(screen.getByRole('radio', { name: label })).toBeTruthy();
    }
    expect(screen.queryByRole('radio', { name: /all/i })).toBeNull();
  });

  it('marks only the selected brand as checked', () => {
    render(
      <ImeiCheckerBrandChips onSelectBrand={vi.fn()} selectedBrand="samsung" />
    );

    expect(
      screen.getByRole('radio', { name: 'Samsung' }).getAttribute(
        'aria-checked'
      )
    ).toBe('true');
    expect(
      screen.getByRole('radio', { name: 'Apple' }).getAttribute('aria-checked')
    ).toBe('false');
  });

  it('calls onSelectBrand with the tapped brand id', () => {
    const onSelectBrand = vi.fn();
    render(
      <ImeiCheckerBrandChips
        onSelectBrand={onSelectBrand}
        selectedBrand="apple"
      />
    );

    fireEvent.click(screen.getByRole('radio', { name: 'Xiaomi' }));

    expect(onSelectBrand).toHaveBeenCalledWith('xiaomi');
  });
});
