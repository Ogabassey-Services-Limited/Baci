import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import Colors from '@/constants/Colors';
import { WalletActionsRow } from './WalletActionsRow';
import { WALLET_COLORS } from './wallet.colors';

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
    const noop = jest.fn();

    render(
      <WalletActionsRow
        colors={Colors.light}
        onManageCards={noop}
        onQuickSave={noop}
        onStartSavings={noop}
        showQuickSave={false}
      />
    );

    expect(screen.queryByRole('button', { name: 'Quick save' })).toBeNull();
  });

  it('keeps manage cards visible on a white button in dark mode', () => {
    const noop = jest.fn();

    render(
      <WalletActionsRow
        colors={Colors.dark}
        onManageCards={noop}
        onQuickSave={noop}
        onStartSavings={noop}
        showQuickSave={false}
      />
    );

    expect(
      StyleSheet.flatten(screen.getByText('Manage Cards').props.style)
    ).toEqual(expect.objectContaining({ color: WALLET_COLORS.darkText }));
  });
});
