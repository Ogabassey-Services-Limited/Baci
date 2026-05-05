import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import WalletTabScreen from '@/app/(tabs)/wallet';

const mockWalletScreen = jest.fn(
  ({ presentation }: { presentation?: 'stack' | 'tab' }) => (
    <Text>{`wallet-presentation:${presentation ?? 'stack'}`}</Text>
  )
);

jest.mock('@/app/wallet', () => ({
  __esModule: true,
  default: (props: { presentation?: 'stack' | 'tab' }) =>
    mockWalletScreen(props),
}));

describe('WalletTabScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the full wallet experience as the tab root screen', () => {
    render(<WalletTabScreen />);

    expect(mockWalletScreen).toHaveBeenCalledWith({ presentation: 'tab' });
    expect(screen.getByText('wallet-presentation:tab')).toBeOnTheScreen();
  });
});
