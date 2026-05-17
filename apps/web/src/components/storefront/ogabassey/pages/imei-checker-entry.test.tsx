import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { OgabasseyImeiEntry } from './imei-checker-entry';
import { SERVICE_TIERS } from './imei-checker-tiers';

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => (
    <img {...props} alt={String(props.alt ?? '')} />
  ),
}));

function renderEntry(overrides = {}) {
  const props = {
    currentTier: SERVICE_TIERS.full,
    deviceQuery: '',
    error: null,
    imei: '354442067957452',
    isLoading: false,
    onCheck: vi.fn((event: React.FormEvent) => event.preventDefault()),
    onDeviceQueryChange: vi.fn(),
    onDeviceSearchFocus: vi.fn(),
    onImeiChange: vi.fn(),
    onSelectDevice: vi.fn(),
    onSelectedTierChange: vi.fn(),
    onShowTierPickerChange: vi.fn(),
    searchLoading: false,
    selectedDevice: null,
    selectedTier: 'full' as const,
    showSuggestions: true,
    showTierPicker: false,
    suggestions: [
      {
        category: 'Phones',
        id: 'p1',
        image: '/phone.png',
        name: 'iPhone 15 Pro',
      },
    ],
    ...overrides,
  };

  render(<OgabasseyImeiEntry {...props} />);
  return props;
}

describe('OgabasseyImeiEntry', () => {
  it('renders suggestions and selects a device', () => {
    const props = renderEntry();

    fireEvent.click(screen.getByRole('button', { name: /iphone 15 pro/i }));

    expect(props.onSelectDevice).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'p1', name: 'iPhone 15 Pro' })
    );
  });

  it('selects service tiers', () => {
    const props = renderEntry();

    fireEvent.click(
      screen.getByRole('button', {
        name: /network check, will my sim work\?, ₦1,000/i,
      })
    );

    expect(props.onSelectedTierChange).toHaveBeenCalledWith('carrier');
  });

  it('sanitizes IMEI input before emitting changes', () => {
    const props = renderEntry({ imei: '' });

    fireEvent.change(screen.getByPlaceholderText(/enter 15-digit imei/i), {
      target: { value: 'abc354442067957452999' },
    });

    expect(props.onImeiChange).toHaveBeenCalledWith('354442067957452');
  });

  it('submits valid IMEI checks and disables invalid checks', () => {
    const props = renderEntry();

    fireEvent.submit(screen.getByPlaceholderText(/enter 15-digit imei/i));

    expect(props.onCheck).toHaveBeenCalledOnce();

    renderEntry({ imei: '35444206795745' });

    expect(screen.getAllByRole('button', { name: /verify now/i })[1]).toBeDisabled();
  });

  it('shows loading and error states', () => {
    renderEntry({
      error: 'Wallet balance is too low.',
      isLoading: true,
    });

    expect(screen.getByText('Wallet balance is too low.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /verify now/i })).toBeDisabled();
  });
});
