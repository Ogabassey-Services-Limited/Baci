import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OgabasseyImeiResults } from './imei-results';
import type { ImeiResult } from './imei-checker-types';

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => (
    <img {...props} alt={String(props.alt ?? '')} />
  ),
}));

const baseResult: ImeiResult = {
  blacklistStatus: 'Clean',
  carrier: 'Unlocked',
  device: 'iPhone 15 Pro',
  deviceImage: '',
  deviceType: 'apple',
  icloud: 'Off',
  icloudLock: 'Off',
  imei: '354442067957452',
  modelNumber: 'A3101',
  score: 98,
  simLock: 'Unlocked',
  status: 'Clean',
  verdict: 'Safe to buy',
  verdictType: 'safe',
};

describe('OgabasseyImeiResults', () => {
  it('renders nothing without a result', () => {
    const { container } = render(
      <OgabasseyImeiResults
        currentTierName="Full Report"
        onReset={vi.fn()}
        result={null}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders clean and non-clean status tones', () => {
    const { rerender } = render(
      <OgabasseyImeiResults
        currentTierName="Full Report"
        onReset={vi.fn()}
        result={baseResult}
      />
    );

    expect(screen.getByText('98%')).toHaveClass(
      'text-[var(--store-success-text,#166534)]'
    );
    expect(screen.getByText('Clean')).toHaveClass(
      'text-[var(--store-success-text,#166534)]'
    );

    rerender(
      <OgabasseyImeiResults
        currentTierName="Full Report"
        onReset={vi.fn()}
        result={{
          ...baseResult,
          blacklistStatus: 'Blacklisted',
          score: 12,
          status: 'Blacklisted',
        }}
      />
    );

    expect(screen.getByText('12%')).toHaveClass(
      'text-[var(--store-danger-text,#dc2626)]'
    );
    expect(screen.getByText('Blacklisted')).toHaveClass(
      'text-[var(--store-danger-text,#dc2626)]'
    );
  });

  it.each([
    ['safe', 'Safe to buy', 'text-[var(--store-success-text,#166534)]'],
    ['danger', 'Do not buy', 'text-[var(--store-danger-text,#dc2626)]'],
    ['caution', 'Verify with seller', 'text-[var(--store-warning-text,#854d0e)]'],
  ] as const)('renders %s verdict tone', (verdictType, verdict, textClass) => {
    render(
      <OgabasseyImeiResults
        currentTierName="Full Report"
        onReset={vi.fn()}
        result={{ ...baseResult, verdict, verdictType }}
      />
    );

    expect(screen.getByText(verdict)).toHaveClass(textClass);
  });

  it('calls onReset from the reset action', () => {
    const onReset = vi.fn();
    render(
      <OgabasseyImeiResults
        currentTierName="Full Report"
        onReset={onReset}
        result={baseResult}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /check another device/i }));

    expect(onReset).toHaveBeenCalledOnce();
  });
});
