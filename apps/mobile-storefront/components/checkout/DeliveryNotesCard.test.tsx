import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { DeliveryNotesCard } from './DeliveryNotesCard';

const mockColors = {
  card: '#ffffff',
  text: '#111827',
  textSecondary: '#6b7280',
} as Parameters<typeof DeliveryNotesCard>[0]['colors'];

describe('DeliveryNotesCard', () => {
  it('renders the Delivery Notes title', () => {
    render(
      <DeliveryNotesCard colors={mockColors} isDark={false}>
        <Text>Leave at door</Text>
      </DeliveryNotesCard>
    );
    expect(screen.getByText('Delivery Notes')).toBeTruthy();
  });

  it('renders the Notes (Optional) label', () => {
    render(
      <DeliveryNotesCard colors={mockColors} isDark={false}>
        <Text>Leave at door</Text>
      </DeliveryNotesCard>
    );
    expect(screen.getByText('Notes (Optional)')).toBeTruthy();
  });

  it('renders children inside the card body', () => {
    render(
      <DeliveryNotesCard colors={mockColors} isDark={false}>
        <Text>Ring doorbell twice</Text>
      </DeliveryNotesCard>
    );
    expect(screen.getByText('Ring doorbell twice')).toBeTruthy();
  });
});
