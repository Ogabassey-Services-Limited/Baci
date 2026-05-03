import { fireEvent, render, screen } from '@testing-library/react-native';
import { ShippingQuotesRetryCard } from './ShippingQuotesRetryCard';

const mockColors = {
  card: '#ffffff',
  text: '#111827',
  textSecondary: '#6b7280',
  warning: '#f59e0b',
} as Parameters<typeof ShippingQuotesRetryCard>[0]['colors'];

describe('ShippingQuotesRetryCard', () => {
  it('renders the title, subtitle, and refresh badge in light mode', () => {
    render(
      <ShippingQuotesRetryCard
        colors={mockColors}
        isDark={false}
        onRetryQuotes={jest.fn()}
      />
    );

    expect(screen.getByText(/oops! rates took a detour/i)).toBeTruthy();
    expect(screen.getByText(/our delivery partners are a bit slow/i)).toBeTruthy();
    expect(screen.getByText(/refresh rates/i)).toBeTruthy();
  });

  it('calls onRetryQuotes when the pressable is tapped', () => {
    const onRetryQuotes = jest.fn();
    render(
      <ShippingQuotesRetryCard
        colors={mockColors}
        isDark={false}
        onRetryQuotes={onRetryQuotes}
      />
    );

    fireEvent.press(screen.getByRole('button', { name: /reload delivery rates/i }));
    expect(onRetryQuotes).toHaveBeenCalledTimes(1);
  });

  it('renders without errors in dark mode', () => {
    render(
      <ShippingQuotesRetryCard
        colors={mockColors}
        isDark
        onRetryQuotes={jest.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /reload delivery rates/i })).toBeTruthy();
  });
});
