import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { VtuCustomerOptionsCards } from './vtu-customer-options-cards';
import { DEFAULT_VTU_SETTINGS } from './vtu-settings-types';

describe('VtuCustomerOptionsCards', () => {
  it('adds an entered checkout amount through the supplied action', async () => {
    const user = userEvent.setup();
    const addAmount = vi.fn();
    const setNewAmount = vi.fn();
    render(
      <VtuCustomerOptionsCards
        addAmount={addAmount}
        newAmount="2000"
        removeAmount={vi.fn()}
        setNewAmount={setNewAmount}
        setSettings={vi.fn()}
        settings={{
          ...DEFAULT_VTU_SETTINGS,
          vtu_enabled: true,
          vtu_checkout_addon_enabled: true,
        }}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(addAmount).toHaveBeenCalledOnce();
  });
});
