import { render, screen } from '@testing-library/react-native';
import {
  InsuranceCardHeader,
  InsuranceValueRow,
} from './OrderDetailsInsuranceCard.primitives';

const colors = {
  card: '#ffffff',
  text: '#111827',
  textSecondary: '#6b7280',
} as const;

describe('OrderDetailsInsuranceCard primitives', () => {
  it('renders the shared insurance card header', () => {
    render(
      <InsuranceCardHeader
        colors={colors}
        iconColor={colors.textSecondary}
        iconName="shield-outline"
      />
    );

    expect(screen.getByText('Insurance Coverage')).toBeTruthy();
  });

  it('exposes the header title with a heading accessibility role', () => {
    render(
      <InsuranceCardHeader
        colors={colors}
        iconColor={colors.textSecondary}
        iconName="shield-outline"
      />
    );

    expect(
      screen.getByRole('header', { name: 'Insurance Coverage' })
    ).toBeTruthy();
  });

  it('renders an insurance label-value row', () => {
    render(
      <InsuranceValueRow colors={colors} label="Coverage" value="₦250,000" />
    );

    expect(screen.getByText('Coverage')).toBeTruthy();
    expect(screen.getByText('₦250,000')).toBeTruthy();
  });

  it('renders a row with an empty value without crashing', () => {
    render(<InsuranceValueRow colors={colors} label="Premium" value="" />);

    // Label still renders; the empty value is a benign minimal state.
    expect(screen.getByText('Premium')).toBeTruthy();
  });
});
