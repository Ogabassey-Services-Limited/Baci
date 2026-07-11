import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RepairReviewStep } from './RepairReviewStep';

const baseFormData = {
  customerName: 'Ada Lovelace',
  customerPhone: '+2348012345678',
  deviceModel: 'iPhone 13 Pro Max',
  deviceType: 'Smartphone',
  issueDescription: 'Screen is cracked.',
  serviceType: 'dropoff',
};

describe('RepairReviewStep', () => {
  it('renders the device, issue and contact summary', () => {
    render(<RepairReviewStep formData={baseFormData} shippingQuote={null} />);

    expect(
      screen.getByText('Smartphone - iPhone 13 Pro Max')
    ).toBeInTheDocument();
    expect(screen.getByText('Screen is cracked.')).toBeInTheDocument();
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('+2348012345678')).toBeInTheDocument();
  });

  it('shows the pickup address and shipping quote price for pickup bookings', () => {
    render(
      <RepairReviewStep
        formData={{
          ...baseFormData,
          pickupAddress: '12 Adeola Odeku Street',
          serviceType: 'pickup',
        }}
        shippingQuote={{
          formattedPrice: '₦3,000',
          isFree: false,
          price: 3000,
        }}
      />
    );

    expect(screen.getByText(/12 adeola odeku street/i)).toBeInTheDocument();
    expect(screen.getByText('₦3,000')).toBeInTheDocument();
  });

  it('shows "As soon as possible" when no preferred date is set', () => {
    render(<RepairReviewStep formData={baseFormData} shippingQuote={null} />);

    expect(screen.getByText('As soon as possible')).toBeInTheDocument();
  });
});
