import { render, screen } from '@testing-library/react-native';
import { TypingIndicator } from '@/components/chat/TypingIndicator';

describe('TypingIndicator', () => {
  it('renders an accessible typing indicator with three animated dots', () => {
    render(<TypingIndicator />);

    expect(
      screen.getByLabelText('Ogabassey AI is typing')
    ).toBeTruthy();
    expect(screen.getAllByTestId('typing-indicator-dot')).toHaveLength(3);
  });
});
