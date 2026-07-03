import { render, screen } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import Colors from '@/constants/Colors';
import { CheckoutSectionCard } from './CheckoutSectionCard';

const colors = Colors.dark;

describe('CheckoutSectionCard', () => {
  it('renders the title, optional action, and children', () => {
    render(
      <CheckoutSectionCard
        icon="cube-outline"
        title="Delivery Methods"
        colors={colors}
        isDark
        action={<Text>Edit</Text>}
      >
        <Text>BODY</Text>
      </CheckoutSectionCard>
    );

    expect(screen.getByText('Delivery Methods')).toBeTruthy();
    expect(screen.getByText('Edit')).toBeTruthy();
    expect(screen.getByText('BODY')).toBeTruthy();
  });

  it('sets overflow visible only when asked (for in-card dropdowns)', () => {
    const { rerender } = render(
      <CheckoutSectionCard icon="cube-outline" title="A" colors={colors} isDark>
        <Text>x</Text>
      </CheckoutSectionCard>
    );
    let card = StyleSheet.flatten(
      screen.getByTestId('checkout-section-card').props.style
    );
    expect(card.overflow).not.toBe('visible');

    rerender(
      <CheckoutSectionCard
        icon="cube-outline"
        title="A"
        colors={colors}
        isDark
        overflowVisible
      >
        <Text>x</Text>
      </CheckoutSectionCard>
    );
    card = StyleSheet.flatten(
      screen.getByTestId('checkout-section-card').props.style
    );
    expect(card.overflow).toBe('visible');
  });
});
