import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { QuizAttempt } from '@/services/quiz';
import { QuizQuestionCard } from './QuizQuestionCard';
import { createQuizStyles, type QuizThemeColors } from './QuizScreen.styles';

const themeColors: QuizThemeColors = {
  background: '#fff',
  border: '#ddd',
  card: '#fff',
  error: '#dc2626',
  muted: '#e5e7eb',
  primary: '#dc2626',
  primaryLowOpacity: 'rgba(220, 38, 38, 0.1)',
  primaryForeground: '#fff',
  success: '#16a34a',
  text: '#111827',
  textSecondary: '#6b7280',
  warning: '#f59e0b',
};

const attempt: QuizAttempt = {
  attemptId: 'attempt-1',
  eventId: 'event-1',
  examPassPointsSpent: 1,
  remainingLoyaltyPoints: 4,
  question: {
    id: 'question-1',
    index: 1,
    options: [
      { id: 'a', label: '3' },
      { id: 'b', label: '4' },
    ],
    prompt: 'What is 2 + 2?',
    timeLimitSeconds: 30,
    total: 3,
  },
};

describe('QuizQuestionCard', () => {
  it('renders the question, progress, and answer options', () => {
    render(
      <QuizQuestionCard
        attempt={attempt}
        isSubmitting={false}
        onSelectAnswer={jest.fn()}
        onSubmit={jest.fn()}
        selectedOptionId={null}
        styles={createQuizStyles(themeColors)}
      />
    );

    expect(screen.getByText('What is 2 + 2?')).toBeTruthy();
    expect(screen.getByLabelText('Question 1 of 3')).toHaveProp(
      'accessibilityRole',
      'progressbar'
    );
    expect(screen.getByRole('button', { name: 'Answer 3' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Answer 4' })).toBeTruthy();
  });

  it('calls onSelectAnswer when an option is pressed', () => {
    const onSelectAnswer = jest.fn();
    render(
      <QuizQuestionCard
        attempt={attempt}
        isSubmitting={false}
        onSelectAnswer={onSelectAnswer}
        onSubmit={jest.fn()}
        selectedOptionId={null}
        styles={createQuizStyles(themeColors)}
      />
    );

    fireEvent.press(screen.getByRole('button', { name: 'Answer 4' }));

    expect(onSelectAnswer).toHaveBeenCalledWith('b');
  });

  it('disables the submit button until an option is selected', () => {
    render(
      <QuizQuestionCard
        attempt={attempt}
        isSubmitting={false}
        onSelectAnswer={jest.fn()}
        onSubmit={jest.fn()}
        selectedOptionId={null}
        styles={createQuizStyles(themeColors)}
      />
    );

    expect(
      screen.getByRole('button', { name: 'Submit answer' })
    ).toHaveAccessibilityState({ disabled: true });
  });

  it('calls onSubmit when the submit button is pressed with a selection', () => {
    const onSubmit = jest.fn();
    render(
      <QuizQuestionCard
        attempt={attempt}
        isSubmitting={false}
        onSelectAnswer={jest.fn()}
        onSubmit={onSubmit}
        selectedOptionId="b"
        styles={createQuizStyles(themeColors)}
      />
    );

    fireEvent.press(screen.getByRole('button', { name: 'Submit answer' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('disables answer and submit controls while submitting', () => {
    render(
      <QuizQuestionCard
        attempt={attempt}
        isSubmitting
        onSelectAnswer={jest.fn()}
        onSubmit={jest.fn()}
        selectedOptionId="b"
        styles={createQuizStyles(themeColors)}
      />
    );

    expect(
      screen.getByRole('button', { name: 'Answer 3' })
    ).toHaveAccessibilityState({ disabled: true });
    expect(
      screen.getByRole('button', { name: 'Submit answer' })
    ).toHaveAccessibilityState({ disabled: true });
  });
});
