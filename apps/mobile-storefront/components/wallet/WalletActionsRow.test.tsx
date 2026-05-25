import { fireEvent, render, screen } from '@testing-library/react-native';
import Colors from '@/constants/Colors';
import { WalletActionsRow } from './WalletActionsRow';

describe('WalletActionsRow', () => {
  it('wires primary wallet actions', () => {
    const onManageCards = jest.fn();
    const onQuickSave = jest.fn();
    const onStartSavings = jest.fn();

    render(
      <WalletActionsRow
        colors={Colors.light}
        onManageCards={onManageCards}
        onQuickSave={onQuickSave}
        onStartSavings={onStartSavings}
        showQuickSave
      />
    );

    fireEvent.press(screen.getByRole('button', { name: 'Start savings' }));
    fireEvent.press(screen.getByRole('button', { name: 'Manage cards' }));
    fireEvent.press(screen.getByRole('button', { name: 'Quick save' }));

    expect(onStartSavings).toHaveBeenCalledTimes(1);
    expect(onManageCards).toHaveBeenCalledTimes(1);
    expect(onQuickSave).toHaveBeenCalledTimes(1);
  });

  it('hides quick save when no savings context is active', () => {
    render(
      <WalletActionsRow
        colors={Colors.light}
        onManageCards={() => {}}
        onQuickSave={() => {}}
        onStartSavings={() => {}}
        showQuickSave={false}
      />
    );

    expect(screen.queryByRole('button', { name: 'Quick save' })).toBeNull();
  });
});
