import { render, screen } from '@testing-library/react-native';
import { Animated } from 'react-native';
import { TypingIndicator } from '@/components/chat/TypingIndicator';

afterEach(() => {
  jest.restoreAllMocks();
});

describe('TypingIndicator', () => {
  it('renders an accessible typing indicator with three animated dots', () => {
    jest.spyOn(Animated, 'loop').mockReturnValue({
      start: jest.fn(),
      stop: jest.fn(),
      reset: jest.fn(),
    } as unknown as Animated.CompositeAnimation);

    render(<TypingIndicator />);

    expect(screen.getByLabelText('Ogabassey AI is typing')).toBeTruthy();
    expect(screen.getAllByTestId('typing-indicator-dot')).toHaveLength(3);
  });
});
