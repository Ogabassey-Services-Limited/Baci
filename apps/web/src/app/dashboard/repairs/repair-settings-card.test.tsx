import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RepairSettingsCard } from './repair-settings-card';

const mocks = vi.hoisted(() => ({
  getRepairSettings: vi.fn(),
  saveRepairSettings: vi.fn(),
}));

vi.mock('./bookings-api', () => ({
  getRepairSettings: mocks.getRepairSettings,
  saveRepairSettings: mocks.saveRepairSettings,
}));

describe('RepairSettingsCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.saveRepairSettings.mockResolvedValue({ repairSettings: {} });
  });

  it('loads existing settings into the form', async () => {
    mocks.getRepairSettings.mockResolvedValueOnce({
      repairSettings: {
        pickup_enabled: true,
        pickup_address: '3 Olayeni Street',
        city: 'Ikeja',
        state: 'Lagos',
      },
      repairsCatalogEnabled: true,
    });

    render(<RepairSettingsCard />);

    const address = (await screen.findByLabelText(
      'Repair-center address'
    )) as HTMLInputElement;
    expect(address.value).toBe('3 Olayeni Street');
  });

  it('saves the edited settings', async () => {
    mocks.getRepairSettings.mockResolvedValueOnce({
      repairSettings: null,
      repairsCatalogEnabled: true,
    });

    render(<RepairSettingsCard />);
    const city = await screen.findByLabelText('City');
    fireEvent.change(city, { target: { value: 'Ikeja' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));

    await waitFor(() =>
      expect(mocks.saveRepairSettings).toHaveBeenCalledWith(
        expect.objectContaining({ city: 'Ikeja' })
      )
    );
    expect(
      await screen.findByText('Repair settings saved.')
    ).toBeInTheDocument();
  });

  it('surfaces a save error', async () => {
    mocks.getRepairSettings.mockResolvedValueOnce({
      repairSettings: null,
      repairsCatalogEnabled: true,
    });
    mocks.saveRepairSettings.mockRejectedValueOnce(new Error('bad'));

    render(<RepairSettingsCard />);
    await screen.findByLabelText('City');
    fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));

    expect(await screen.findByText(/Failed to save/i)).toBeInTheDocument();
  });
});
