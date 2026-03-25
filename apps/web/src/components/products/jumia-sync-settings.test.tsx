import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { JumiaSyncSettings } from './jumia-sync-settings';

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

vi.mock('@/components/ui/switch', () => ({
  Switch: ({
    id,
    checked,
    onCheckedChange,
  }: {
    id?: string;
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
  }) => (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
    >
      {checked ? 'On' : 'Off'}
    </button>
  ),
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

describe('JumiaSyncSettings', () => {
  it('renders sync labels and heading', () => {
    render(
      <JumiaSyncSettings overrides={createOverrides()} setOverrides={vi.fn()} />
    );

    expect(screen.getByText('Real-time Sync')).toBeInTheDocument();
    expect(screen.getByText('Sync Inventory')).toBeInTheDocument();
    expect(screen.getByText('Sync Price changes')).toBeInTheDocument();
  });

  it('renders description text for each toggle', () => {
    render(
      <JumiaSyncSettings overrides={createOverrides()} setOverrides={vi.fn()} />
    );

    expect(
      screen.getByText('Keep Jumia stock matched with Baci')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Auto-update Jumia when Baci price changes')
    ).toBeInTheDocument();
  });

  it('reflects syncInventory and syncPrice state in switches', () => {
    render(
      <JumiaSyncSettings
        overrides={createOverrides({
          syncInventory: true,
          syncPrice: false,
        })}
        setOverrides={vi.fn()}
      />
    );

    const switches = screen.getAllByRole('switch');
    expect(switches[0]).toHaveAttribute('aria-checked', 'true');
    expect(switches[1]).toHaveAttribute('aria-checked', 'false');
  });

  it('calls setOverrides when inventory sync switch is toggled', async () => {
    const user = userEvent.setup();
    const setOverrides = vi.fn();
    render(
      <JumiaSyncSettings
        overrides={createOverrides({ syncInventory: false })}
        setOverrides={setOverrides}
      />
    );

    const switches = screen.getAllByRole('switch');
    await user.click(switches[0]);

    expect(setOverrides).toHaveBeenCalledWith(expect.any(Function));
    // Call the updater function to verify it toggles syncInventory
    const updater = setOverrides.mock.calls[0][0] as (
      prev: ReturnType<typeof createOverrides>
    ) => ReturnType<typeof createOverrides>;
    const result = updater(createOverrides({ syncInventory: false }));
    expect(result.syncInventory).toBe(true);
  });

  it('calls setOverrides when price sync switch is toggled', async () => {
    const user = userEvent.setup();
    const setOverrides = vi.fn();
    render(
      <JumiaSyncSettings
        overrides={createOverrides({ syncPrice: false })}
        setOverrides={setOverrides}
      />
    );

    const switches = screen.getAllByRole('switch');
    await user.click(switches[1]);

    expect(setOverrides).toHaveBeenCalledWith(expect.any(Function));
    const updater = setOverrides.mock.calls[0][0] as (
      prev: ReturnType<typeof createOverrides>
    ) => ReturnType<typeof createOverrides>;
    const result = updater(createOverrides({ syncPrice: false }));
    expect(result.syncPrice).toBe(true);
  });
});
