import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { FAQStoreInfo } from '@/components/faq/FAQStoreInfo';

describe('FAQStoreInfo', () => {
  it('renders the store hours and address', () => {
    render(
      <FAQStoreInfo
        address="Computer Village, Ikeja, Lagos"
        cardColor="#fff"
        hours={[
          {
            id: 'weekdays',
            label: 'Monday - Saturday: 9:00 AM - 7:00 PM',
          },
        ]}
        secondaryTextColor="#666"
        textColor="#111"
      />
    );

    expect(
      screen.getByRole('header', { name: 'Store Hours' })
    ).toBeOnTheScreen();
    expect(
      screen.getByText('Monday - Saturday: 9:00 AM - 7:00 PM')
    ).toBeOnTheScreen();
    expect(
      screen.getByText('Computer Village, Ikeja, Lagos')
    ).toBeOnTheScreen();
  });
});
