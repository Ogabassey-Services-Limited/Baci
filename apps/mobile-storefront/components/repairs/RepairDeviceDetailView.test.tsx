import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

jest.mock('@react-native-vector-icons/ionicons', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/components/useColorScheme', () => ({
  useColorScheme: () => 'light',
}));

import { RepairDeviceDetailView } from './RepairDeviceDetailView';

const device = {
  id: 'd1',
  brand: 'Apple',
  model: 'iPhone 13',
  slug: 'apple-iphone-13',
  deviceType: 'Smartphone' as const,
  imageUrl: null,
  productId: null,
};

const detailWithQuotes = {
  device,
  quotes: [
    {
      id: 'q1',
      serviceTypeId: 'st1',
      serviceTypeName: 'Screen Replacement',
      price: 25000,
      isFromPrice: true,
      partQuality: 'OEM',
      turnaround: '2 days',
      warrantyDays: 90,
      description: 'Genuine display swap',
    },
  ],
  product: {
    id: 'p1',
    slug: 'iphone-13',
    name: 'iPhone 13',
    imageUrl: null,
    keySpecs: [{ label: 'RAM', value: '4GB' }],
  },
};

describe('RepairDeviceDetailView', () => {
  const onBookQuote = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the device name, quote, and "From" price', () => {
    render(
      <RepairDeviceDetailView
        detail={detailWithQuotes}
        onBookQuote={onBookQuote}
      />
    );

    expect(screen.getByText('iPhone 13')).toBeTruthy();
    expect(screen.getByText('Screen Replacement')).toBeTruthy();
    expect(screen.getByText('From ₦25,000')).toBeTruthy();
    expect(screen.getByText('RAM: 4GB')).toBeTruthy();
  });

  it('shows an exact price (no "From") when isFromPrice is false', () => {
    render(
      <RepairDeviceDetailView
        detail={{
          ...detailWithQuotes,
          quotes: [{ ...detailWithQuotes.quotes[0], isFromPrice: false }],
        }}
        onBookQuote={onBookQuote}
      />
    );

    expect(screen.getByText('₦25,000')).toBeTruthy();
    expect(screen.queryByText('From ₦25,000')).toBeNull();
  });

  it('calls onBookQuote with the selected quote when its CTA is pressed', () => {
    render(
      <RepairDeviceDetailView
        detail={detailWithQuotes}
        onBookQuote={onBookQuote}
      />
    );

    fireEvent.press(screen.getByLabelText('Book Screen Replacement'));

    expect(onBookQuote).toHaveBeenCalledWith(detailWithQuotes.quotes[0]);
  });

  it('shows a no-quotes message and a book-without-quote CTA when there are no quotes', () => {
    render(
      <RepairDeviceDetailView
        detail={{ ...detailWithQuotes, quotes: [], product: null }}
        onBookQuote={onBookQuote}
      />
    );

    expect(screen.getByText(/No fixed prices listed/)).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Request a quote for this device'));

    expect(onBookQuote).toHaveBeenCalledWith(null);
  });
});
