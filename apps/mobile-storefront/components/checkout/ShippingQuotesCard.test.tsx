import { fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { ShippingQuotesCard } from './ShippingQuotesCard';

const mockColors = {
  card: '#ffffff',
  text: '#111827',
  textSecondary: '#6b7280',
  border: '#e5e7eb',
  background: '#f9fafb',
  warning: '#f59e0b',
} as Parameters<typeof ShippingQuotesCard>[0]['colors'];

const baseProps = {
  colors: mockColors,
  isDark: false,
  isLoadingQuotes: false,
  shippingQuotes: [],
  selectedQuoteId: '',
  onSelectQuote: jest.fn(),
  onRetryQuotes: jest.fn(),
};

describe('ShippingQuotesCard', () => {
  let announceSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    announceSpy = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
  });

  it('shows loading text when isLoadingQuotes is true and announces it', () => {
    render(<ShippingQuotesCard {...baseProps} isLoadingQuotes />);

    expect(screen.getByText(/fetching delivery options/i)).toBeTruthy();
    expect(announceSpy).toHaveBeenCalledWith('Fetching delivery options…');
  });

  it('shows retry card when no quotes are available', () => {
    render(<ShippingQuotesCard {...baseProps} shippingQuotes={[]} />);

    expect(screen.getByText(/oops! rates took a detour/i)).toBeTruthy();
    expect(screen.getByText(/refresh rates/i)).toBeTruthy();
  });

  it('explains when only GIGL pickup stations are available for a door address', () => {
    render(
      <ShippingQuotesCard
        {...baseProps}
        shippingQuotes={[]}
        stationPickupQuote={{
          id: 'station-quote',
          displayName: 'GIG Logistics - Pickup at PORT HARCOURT',
          isStationPickup: true,
          price: 9493,
          provider: 'GIGL',
          stationName: 'PORT HARCOURT',
        }}
      />
    );

    expect(
      screen.getByText(
        /gigl doesn't currently support door delivery to this location/i
      )
    ).toBeTruthy();
    expect(screen.getByText(/choose pickup stations \(gigl\)/i)).toBeTruthy();
  });

  it('calls onRetryQuotes when retry pressable is pressed', () => {
    render(<ShippingQuotesCard {...baseProps} shippingQuotes={[]} />);

    fireEvent.press(
      screen.getByRole('button', { name: /reload delivery rates/i })
    );
    expect(baseProps.onRetryQuotes).toHaveBeenCalledTimes(1);
  });

  it('renders each quote with displayName and accessibilityLabel', () => {
    const quotes = [
      {
        id: 'q1',
        displayName: 'Standard Delivery',
        price: 3500,
        carrierName: 'Topship',
        estimatedDays: 2,
      },
      {
        id: 'q2',
        displayName: 'Express Delivery',
        price: 6000,
        carrierName: 'DHL',
        deliveryRange: '1-2 days',
      },
    ];

    render(
      <ShippingQuotesCard
        {...baseProps}
        shippingQuotes={quotes}
        selectedQuoteId=""
      />
    );

    expect(screen.getByText('Standard Delivery')).toBeTruthy();
    expect(screen.getByText('Express Delivery')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: /select standard delivery/i })
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: /select express delivery/i })
    ).toBeTruthy();
  });

  it('renders an accessible GIG Logistics brand mark for GIGL quotes', () => {
    render(
      <ShippingQuotesCard
        {...baseProps}
        shippingQuotes={[
          {
            id: 'gigl-quote',
            displayName: 'GIG Logistics - Home Delivery',
            price: 81309,
            carrierName: 'GIG Logistics',
            provider: 'GIGL',
          },
        ]}
      />
    );

    expect(screen.getByLabelText('GIG Logistics logo')).toBeTruthy();
  });

  it('calls onSelectQuote with the quote id when a quote is pressed', () => {
    const quotes = [
      { id: 'q1', displayName: 'Standard Delivery', price: 3500 },
    ];

    render(<ShippingQuotesCard {...baseProps} shippingQuotes={quotes} />);

    fireEvent.press(
      screen.getByRole('button', { name: /select standard delivery/i })
    );
    expect(baseProps.onSelectQuote).toHaveBeenCalledWith('q1');
  });
});
