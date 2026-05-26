import { render, screen } from '@testing-library/react-native';
import { TrackOrderTimelineCard } from './TrackOrderTimelineCard';

const colors = {
  border: '#e5e7eb',
  card: '#ffffff',
  text: '#111827',
  textSecondary: '#6b7280',
} as const;

describe('TrackOrderTimelineCard', () => {
  it('renders timeline events with formatted timestamps', () => {
    render(
      <TrackOrderTimelineCard
        colors={colors}
        timeline={[
          {
            description: 'We received your order.',
            icon: 'order',
            status: 'completed',
            timestamp: '2026-05-24T10:30:00',
            title: 'Order placed',
          },
          {
            description: 'Your order is being prepared.',
            icon: 'processing',
            status: 'current',
            timestamp: '',
            title: 'Processing',
          },
        ]}
      />
    );

    expect(screen.getByText('Order Timeline')).toBeTruthy();
    expect(screen.getByText('Order placed')).toBeTruthy();
    expect(screen.getByText('We received your order.')).toBeTruthy();
    expect(screen.getByText('24 May, 10:30')).toBeTruthy();
    expect(screen.getByText('Processing')).toBeTruthy();
    expect(screen.getByText('Your order is being prepared.')).toBeTruthy();
  });
});
