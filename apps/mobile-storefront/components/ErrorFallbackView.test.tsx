import { fireEvent, render, screen } from '@testing-library/react-native';
import Colors from '@/constants/Colors';
import { ErrorFallbackView } from './ErrorFallbackView';
import { getErrorContent } from './error-boundary-content';

describe('ErrorFallbackView', () => {
  it('renders fallback content and calls retry action', () => {
    const onRetry = jest.fn();

    render(
      <ErrorFallbackView
        colors={Colors.light}
        content={getErrorContent('network')}
        onRetry={onRetry}
      />
    );

    fireEvent.press(screen.getByRole('button', { name: 'Retry' }));

    expect(screen.getByText('Connection Error')).toBeTruthy();
    expect(onRetry).toHaveBeenCalled();
  });

  it('renders debug context when an error is available in dev', () => {
    render(
      <ErrorFallbackView
        colors={Colors.light}
        content={getErrorContent('general')}
        debugContext="checkout"
        error={new Error('Boom')}
        onRetry={jest.fn()}
      />
    );

    expect(screen.getByText('Debug Info (checkout):')).toBeTruthy();
    expect(screen.getByText('Boom')).toBeTruthy();
  });
});
