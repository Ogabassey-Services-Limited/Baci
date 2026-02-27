/**
 * Tests for PricingSection component.
 *
 * Verifies:
 * - effectivePrice always renders via formatPrice
 * - effectiveComparePrice renders struck-through only when > effectivePrice
 * - Negotiated badge shows when negotiatedPrice != null (including 0)
 * - "Make an Offer" button shows when negotiatedPrice == null and fires callback
 */

import { fireEvent, render, screen } from '@testing-library/react-native';
import { PricingSection } from '@/components/product/PricingSection';
import Colors from '@/constants/Colors';

// formatPrice is a pure Intl.NumberFormat formatter — no mock needed,
// but we need to know the expected output shape. In the en-NG/NGN locale
// used by the app, formatPrice(1000) produces a string containing "1,000".
// We assert on partial matches to avoid locale-specific prefix sensitivity.

const mockColors = Colors.light;

// ---------------------------------------------------------------------------
// effectivePrice display
// ---------------------------------------------------------------------------

describe('PricingSection — effectivePrice display', () => {
  it('renders the effective price', () => {
    render(
      <PricingSection
        effectivePrice={5000}
        effectiveComparePrice={undefined}
        negotiatedPrice={null}
        onOpenNegotiation={jest.fn()}
        colors={mockColors}
      />
    );

    // formatPrice(5000) produces a currency string containing "5,000"
    expect(screen.getByText(/5,000/)).toBeTruthy();
  });

  it('renders zero price correctly', () => {
    render(
      <PricingSection
        effectivePrice={0}
        effectiveComparePrice={undefined}
        negotiatedPrice={null}
        onOpenNegotiation={jest.fn()}
        colors={mockColors}
      />
    );

    // formatPrice(0) produces a currency string containing "0"
    expect(screen.getByText(/0/)).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// effectiveComparePrice display
// ---------------------------------------------------------------------------

describe('PricingSection — effectiveComparePrice', () => {
  it('renders compare price when it is greater than effectivePrice', () => {
    render(
      <PricingSection
        effectivePrice={3000}
        effectiveComparePrice={5000}
        negotiatedPrice={null}
        onOpenNegotiation={jest.fn()}
        colors={mockColors}
      />
    );

    // Both prices should appear
    expect(screen.getByText(/3,000/)).toBeTruthy();
    expect(screen.getByText(/5,000/)).toBeTruthy();
  });

  it('does not render compare price when it equals effectivePrice', () => {
    render(
      <PricingSection
        effectivePrice={3000}
        effectiveComparePrice={3000}
        negotiatedPrice={null}
        onOpenNegotiation={jest.fn()}
        colors={mockColors}
      />
    );

    // Only one text element with 3,000 should exist (the main price)
    const matches = screen.getAllByText(/3,000/);
    expect(matches).toHaveLength(1);
  });

  it('does not render compare price when it is less than effectivePrice', () => {
    render(
      <PricingSection
        effectivePrice={5000}
        effectiveComparePrice={3000}
        negotiatedPrice={null}
        onOpenNegotiation={jest.fn()}
        colors={mockColors}
      />
    );

    // 5,000 should appear, 3,000 should NOT
    expect(screen.getByText(/5,000/)).toBeTruthy();
    expect(screen.queryByText(/3,000/)).toBeNull();
  });

  it('does not render compare price when it is undefined', () => {
    render(
      <PricingSection
        effectivePrice={5000}
        effectiveComparePrice={undefined}
        negotiatedPrice={null}
        onOpenNegotiation={jest.fn()}
        colors={mockColors}
      />
    );

    // Only the main price should appear
    const matches = screen.getAllByText(/5,000/);
    expect(matches).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Negotiated price badge
// ---------------------------------------------------------------------------

describe('PricingSection — negotiated price badge', () => {
  it('shows negotiated badge when negotiatedPrice is a positive number', () => {
    render(
      <PricingSection
        effectivePrice={2500}
        effectiveComparePrice={undefined}
        negotiatedPrice={2500}
        onOpenNegotiation={jest.fn()}
        colors={mockColors}
      />
    );

    expect(screen.getByText('Your negotiated price!')).toBeTruthy();
  });

  it('shows negotiated badge when negotiatedPrice is 0', () => {
    render(
      <PricingSection
        effectivePrice={0}
        effectiveComparePrice={undefined}
        negotiatedPrice={0}
        onOpenNegotiation={jest.fn()}
        colors={mockColors}
      />
    );

    expect(screen.getByText('Your negotiated price!')).toBeTruthy();
  });

  it('does not show negotiated badge when negotiatedPrice is null', () => {
    render(
      <PricingSection
        effectivePrice={5000}
        effectiveComparePrice={undefined}
        negotiatedPrice={null}
        onOpenNegotiation={jest.fn()}
        colors={mockColors}
      />
    );

    expect(screen.queryByText('Your negotiated price!')).toBeNull();
  });

  it('hides "Make an Offer" when negotiated price is set', () => {
    render(
      <PricingSection
        effectivePrice={5000}
        effectiveComparePrice={undefined}
        negotiatedPrice={3000}
        onOpenNegotiation={jest.fn()}
        colors={mockColors}
      />
    );

    expect(screen.queryByRole('button', { name: /make an offer/i })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Make an Offer button
// ---------------------------------------------------------------------------

describe('PricingSection — Make an Offer button', () => {
  it('shows "Make an Offer" when negotiatedPrice is null', () => {
    render(
      <PricingSection
        effectivePrice={5000}
        effectiveComparePrice={undefined}
        negotiatedPrice={null}
        onOpenNegotiation={jest.fn()}
        colors={mockColors}
      />
    );

    expect(screen.getByRole('button', { name: /make an offer/i })).toBeTruthy();
  });

  it('calls onOpenNegotiation when pressed', () => {
    const onOpen = jest.fn();

    render(
      <PricingSection
        effectivePrice={5000}
        effectiveComparePrice={undefined}
        negotiatedPrice={null}
        onOpenNegotiation={onOpen}
        colors={mockColors}
      />
    );

    fireEvent.press(screen.getByRole('button', { name: /make an offer/i }));

    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('does not show "Make an Offer" when negotiatedPrice is 0', () => {
    render(
      <PricingSection
        effectivePrice={0}
        effectiveComparePrice={undefined}
        negotiatedPrice={0}
        onOpenNegotiation={jest.fn()}
        colors={mockColors}
      />
    );

    expect(screen.queryByRole('button', { name: /make an offer/i })).toBeNull();
  });
});
