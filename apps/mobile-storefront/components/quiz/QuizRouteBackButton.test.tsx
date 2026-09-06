import { jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { useQuizStore } from '@/stores/quiz-store';
import { QuizRouteBackButton } from './QuizRouteBackButton';

const mockRouterBack = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockRouterBack }),
}));

describe('QuizRouteBackButton', () => {
  beforeEach(() => {
    mockRouterBack.mockClear();
    useQuizStore.getState().reset();
  });

  it('returns a completed result to the SuperQuiz lobby without leaving the route', () => {
    useQuizStore.setState({ status: 'result' });
    render(<QuizRouteBackButton color="#ffffff" />);

    fireEvent.press(screen.getByRole('button', { name: 'Back to SuperQuiz' }));

    expect(useQuizStore.getState().status).toBe('idle');
    expect(mockRouterBack).not.toHaveBeenCalled();
  });

  it('uses normal route navigation when already on the SuperQuiz lobby', () => {
    useQuizStore.setState({ status: 'ready' });
    render(<QuizRouteBackButton color="#ffffff" />);

    fireEvent.press(screen.getByRole('button', { name: 'Go back' }));

    expect(mockRouterBack).toHaveBeenCalledTimes(1);
  });
});
