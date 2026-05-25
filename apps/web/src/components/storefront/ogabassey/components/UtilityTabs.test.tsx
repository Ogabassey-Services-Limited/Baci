import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { UtilityTabs } from './UtilityTabs';

vi.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

describe('UtilityTabs', () => {
  it('exposes selected tab semantics and emits a new selection', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(
      <UtilityTabs
        activeTab="airtime"
        onSelect={onSelect}
      />
    );

    expect(screen.getByRole('tablist', { name: 'Utility type' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Airtime' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByRole('tab', { name: 'Data' })).toHaveAttribute(
      'aria-selected',
      'false'
    );

    await user.click(screen.getByRole('tab', { name: 'Data' }));

    expect(onSelect).toHaveBeenCalledWith('data');
  });
});
