import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { VtuServiceCard } from './vtu-service-card';
import { DEFAULT_VTU_SETTINGS } from './vtu-settings-types';

describe('VtuServiceCard', () => {
  it('enables VTU through the supplied merchant settings update', async () => {
    const user = userEvent.setup();
    const setSettings = vi.fn();

    render(
      <VtuServiceCard
        setSettings={setSettings}
        settings={DEFAULT_VTU_SETTINGS}
      />
    );

    await user.click(screen.getByRole('switch'));

    expect(setSettings).toHaveBeenCalledWith({
      ...DEFAULT_VTU_SETTINGS,
      vtu_enabled: true,
    });
  });
});
