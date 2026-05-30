import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { NegotiationProductSummary } from './NegotiationProductSummary';

describe('NegotiationProductSummary', () => {
  it('renders product identity and formatted current price', () => {
    render(
      <NegotiationProductSummary
        currentPrice={500000}
        productName="iPhone 11 Pro Max"
      />
    );

    expect(screen.getByText('PRODUCT')).toBeTruthy();
    expect(screen.getByText('iPhone 11 Pro Max')).toBeTruthy();
    expect(screen.getByText('₦500,000')).toBeTruthy();
  });
});
