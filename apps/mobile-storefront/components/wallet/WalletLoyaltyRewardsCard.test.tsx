import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import Colors from '@/constants/Colors';
import { WalletLoyaltyRewardsCard } from './WalletLoyaltyRewardsCard';

jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual(
    'react-native'
  ) as typeof import('react-native');

  return {
    __esModule: true,
    default: { View },
    FadeIn: {
      duration: () => ({
        delay: () => ({}),
      }),
    },
  };
});

describe('WalletLoyaltyRewardsCard', () => {
  it('shows redeemable rewards without repeating the visible points balance', () => {
    const onOpenRedeemPanel = jest.fn();

    render(
      <WalletLoyaltyRewardsCard
        colors={Colors.dark}
        loyaltyPoints={2000}
        onOpenRedeemPanel={onOpenRedeemPanel}
      />
    );

    expect(screen.getByText('Redeem Rewards')).toBeOnTheScreen();
    expect(screen.queryByText('2,000 pts')).toBeNull();
    expect(
      screen.getByText('2,000 points redeemable now (100 points = ₦100)')
    ).toBeOnTheScreen();

    fireEvent.press(
      screen.getByRole('button', { name: 'Redeem loyalty points' })
    );

    expect(onOpenRedeemPanel).toHaveBeenCalledTimes(1);
  });

  it('disables redemption below the minimum points threshold', () => {
    const onOpenRedeemPanel = jest.fn();

    render(
      <WalletLoyaltyRewardsCard
        colors={Colors.light}
        loyaltyPoints={50}
        onOpenRedeemPanel={onOpenRedeemPanel}
      />
    );

    const redeemButton = screen.getByRole('button', {
      name: 'Redeem loyalty points',
    });

    expect(redeemButton).toBeDisabled();

    fireEvent.press(redeemButton);

    expect(onOpenRedeemPanel).not.toHaveBeenCalled();
  });

  it('renders a provided loyalty tier label', () => {
    render(
      <WalletLoyaltyRewardsCard
        colors={Colors.light}
        loyaltyPoints={2000}
        onOpenRedeemPanel={jest.fn()}
        tier="gold"
      />
    );

    expect(screen.getByText('Gold')).toBeOnTheScreen();
    expect(screen.queryByText('Bronze')).toBeNull();
  });
});
