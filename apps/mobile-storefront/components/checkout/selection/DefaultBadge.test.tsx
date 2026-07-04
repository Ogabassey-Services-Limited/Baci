import { render, screen } from '@testing-library/react-native';
import { DefaultBadge } from './DefaultBadge';

describe('DefaultBadge', () => {
  it('defaults to a "Default" label', () => {
    render(<DefaultBadge />);
    expect(screen.getByText('Default')).toBeTruthy();
  });

  it('renders a custom label (e.g. the pickup "Free" price)', () => {
    render(<DefaultBadge label="Free" />);
    expect(screen.getByText('Free')).toBeTruthy();
  });
});
