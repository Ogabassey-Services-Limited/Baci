import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import Colors from '@/constants/Colors';
import { WalletPanelActionButtons } from './WalletPanelActionButtons';

describe('WalletPanelActionButtons', () => {
  it('wires cancel and confirm actions with accessible button labels', () => {
    const onCancel = jest.fn();
    const onConfirm = jest.fn();

    render(
      <WalletPanelActionButtons
        cancelAccessibilityLabel="Cancel wallet top-up"
        confirmAccessibilityLabel="Confirm wallet top-up"
        confirmText="Continue"
        colors={Colors.light}
        isPending={false}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    );

    fireEvent.press(
      screen.getByRole('button', { name: 'Cancel wallet top-up' })
    );
    fireEvent.press(
      screen.getByRole('button', { name: 'Confirm wallet top-up' })
    );

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('disables and marks confirm button busy while pending', () => {
    render(
      <WalletPanelActionButtons
        cancelAccessibilityLabel="Cancel redeem points"
        confirmAccessibilityLabel="Confirm redeem points"
        confirmText="Redeem"
        colors={Colors.light}
        isPending={true}
        onCancel={jest.fn()}
        onConfirm={jest.fn()}
      />
    );

    const confirmButton = screen.getByRole('button', {
      name: 'Confirm redeem points',
    });

    expect(confirmButton).toBeDisabled();
    expect(confirmButton.props.accessibilityState).toMatchObject({
      busy: true,
      disabled: true,
    });
  });
});
