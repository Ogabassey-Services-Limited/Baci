import { render, screen } from '@testing-library/react-native';
import Colors from '@/constants/Colors';
import { UtilityPaystackTrustBadge } from './UtilityPaystackTrustBadge';

describe('UtilityPaystackTrustBadge', () => {
  it('renders the Paystack trust copy', () => {
    render(<UtilityPaystackTrustBadge colors={Colors.light} isDark={false} />);

    expect(screen.getByText('Secured by')).toBeTruthy();
    expect(screen.getByText('Paystack')).toBeTruthy();
  });

  it('uses the high-contrast Paystack wordmark in dark mode', () => {
    render(<UtilityPaystackTrustBadge colors={Colors.dark} isDark={true} />);

    expect(screen.getByText('Paystack')).toHaveStyle({
      color: '#5CD6FF',
    });
  });
});
