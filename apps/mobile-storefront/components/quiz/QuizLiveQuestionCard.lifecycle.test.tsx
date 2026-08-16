import { describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { QuizLiveQuestionCard } from './QuizLiveQuestionCard';
import { createQuizStyles, type QuizThemeColors } from './QuizScreen.styles';

jest.mock('./QuizMusicPlayer', () => {
  const { Text, View } = require('react-native');
  return {
    QuizMusicPlayer: ({ gameEndsIn }: { gameEndsIn?: string }) => (
      <View>
        <Text>Game ends in {gameEndsIn}</Text>
      </View>
    ),
  };
});

const colors: QuizThemeColors = {
  background: '#000',
  border: '#222',
  card: '#111',
  error: '#f00',
  muted: '#555',
  primary: '#f90',
  primaryLowOpacity: '#321',
  primaryForeground: '#000',
  success: '#0f8',
  text: '#fff',
  textSecondary: '#aaa',
  warning: '#fb0',
};

describe('QuizLiveQuestionCard lifecycle', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(0);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('offers a retry when the server could not confirm the quiz end', () => {
    const onRetryEventExpire = jest.fn();
    render(
      <QuizLiveQuestionCard
        attempt={{
          attemptId: 'a1',
          eventEndsAt: new Date(30_000).toISOString(),
          eventId: 'e1',
          question: {
            deadlineAt: new Date(10_000).toISOString(),
            id: 'q1',
            index: 1,
            options: [{ id: 'o1', label: 'Lagos' }],
            prompt: 'Capital?',
            timeLimitSeconds: 10,
            total: 1,
          },
          resultsAvailableAt: null,
          serverNow: new Date(0).toISOString(),
          status: 'in_progress',
        }}
        expiryRetryable
        lockedOptionId={null}
        onAnswer={jest.fn()}
        onRetryEventExpire={onRetryEventExpire}
        styles={createQuizStyles(colors)}
      />
    );

    expect(
      screen.getByText(
        'We could not confirm the quiz end. Retry to see your results.'
      )
    ).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Retry ending quiz' }));
    expect(onRetryEventExpire).toHaveBeenCalledTimes(1);
  });

  it('unanswered_timeout_submits_once', () => {
    const onAnswer = jest.fn();
    const attempt = {
      attemptId: 'a1',
      eventEndsAt: new Date(30_000).toISOString(),
      eventId: 'e1',
      question: {
        deadlineAt: new Date(1_000).toISOString(),
        id: 'q1',
        index: 1,
        options: [{ id: 'o1', label: 'Lagos' }],
        prompt: 'Capital?',
        timeLimitSeconds: 1,
        total: 20,
      },
      resultsAvailableAt: null,
      serverNow: new Date(0).toISOString(),
      status: 'in_progress' as const,
    };

    render(
      <QuizLiveQuestionCard
        attempt={attempt}
        lockedOptionId={null}
        onAnswer={onAnswer}
        styles={createQuizStyles(colors)}
      />
    );
    act(() => {
      jest.advanceTimersByTime(2_000);
    });

    expect(onAnswer).toHaveBeenCalledTimes(1);
    expect(onAnswer).toHaveBeenCalledWith('__timeout_no_answer__');
  });

  it('counts down from a stable server clock snapshot', () => {
    const attempt = {
      attemptId: 'a1',
      eventEndsAt: new Date(30_000).toISOString(),
      eventId: 'e1',
      question: {
        deadlineAt: new Date(10_000).toISOString(),
        id: 'q1',
        index: 1,
        options: [{ id: 'o1', label: 'Lagos' }],
        prompt: 'Capital?',
        timeLimitSeconds: 10,
        total: 5,
      },
      resultsAvailableAt: null,
      serverNow: new Date(0).toISOString(),
      status: 'in_progress' as const,
    };

    render(
      <QuizLiveQuestionCard
        attempt={attempt}
        lockedOptionId={null}
        onAnswer={jest.fn()}
        styles={createQuizStyles(colors)}
      />
    );
    expect(screen.getByRole('timer')).toHaveTextContent('10s left');

    act(() => {
      jest.advanceTimersByTime(1_250);
    });

    expect(screen.getByRole('timer')).toHaveTextContent('9s left');
  });

  it('starts the next server-issued question at its full time limit', () => {
    const createAttempt = (questionIndex: number) => ({
      attemptId: 'a1',
      eventEndsAt: new Date(60_000).toISOString(),
      eventId: 'e1',
      question: {
        deadlineAt: new Date(questionIndex * 10_000).toISOString(),
        id: `q${questionIndex}`,
        index: questionIndex,
        options: [{ id: 'o1', label: 'Lagos' }],
        prompt: 'Capital?',
        timeLimitSeconds: 10,
        total: 5,
      },
      resultsAvailableAt: null,
      serverNow: new Date((questionIndex - 1) * 10_000).toISOString(),
      status: 'in_progress' as const,
    });
    const { rerender } = render(
      <QuizLiveQuestionCard
        attempt={createAttempt(1)}
        lockedOptionId={null}
        onAnswer={jest.fn()}
        styles={createQuizStyles(colors)}
      />
    );

    act(() => jest.advanceTimersByTime(10_000));
    rerender(
      <QuizLiveQuestionCard
        attempt={createAttempt(2)}
        lockedOptionId={null}
        onAnswer={jest.fn()}
        styles={createQuizStyles(colors)}
      />
    );

    expect(screen.getByRole('timer')).toHaveTextContent('10s left');
  });

  it('keeps the selection visible without loading copy while the next question is requested', () => {
    render(
      <QuizLiveQuestionCard
        attempt={{
          attemptId: 'a1',
          eventEndsAt: new Date(30_000).toISOString(),
          eventId: 'e1',
          question: {
            deadlineAt: new Date(10_000).toISOString(),
            id: 'q1',
            index: 1,
            options: [{ id: 'o1', label: 'Lagos' }],
            prompt: 'Capital?',
            timeLimitSeconds: 10,
            total: 5,
          },
          resultsAvailableAt: null,
          serverNow: new Date(0).toISOString(),
          status: 'in_progress',
        }}
        isSubmitting
        lockedOptionId="o1"
        onAnswer={jest.fn()}
        onRetryLockedAnswer={jest.fn()}
        styles={createQuizStyles(colors)}
      />
    );

    expect(
      screen.queryByRole('button', { name: 'Retry saving answer' })
    ).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Answer Lagos' })
    ).toHaveAccessibilityState({ disabled: true, selected: true });
    expect(screen.queryByText(/Loading next question/i)).toBeNull();
  });

  it('keeps answer dimensions stable after selection', () => {
    const styles = createQuizStyles(colors);
    expect(styles.answerButton.borderWidth).toBe(
      styles.answerButtonSelected.borderWidth
    );
    expect(styles.answerSelectionIcon).toMatchObject({ height: 23, width: 23 });
  });

  it('event_end_caps_question_timer_with_server_offset', () => {
    const onAnswer = jest.fn();
    const onEventExpire = jest.fn();
    const attempt = {
      attemptId: 'a1',
      eventEndsAt: new Date(10_000).toISOString(),
      eventId: 'e1',
      question: {
        deadlineAt: new Date(20_000).toISOString(),
        id: 'q1',
        index: 1,
        options: [{ id: 'o1', label: 'Lagos' }],
        prompt: 'Capital?',
        timeLimitSeconds: 20,
        total: 20,
      },
      resultsAvailableAt: null,
      serverNow: new Date(5_000).toISOString(),
      status: 'in_progress' as const,
    };

    render(
      <QuizLiveQuestionCard
        attempt={attempt}
        lockedOptionId={null}
        onAnswer={onAnswer}
        onEventExpire={onEventExpire}
        styles={createQuizStyles(colors)}
      />
    );
    act(() => {
      jest.advanceTimersByTime(5_250);
    });

    expect(onEventExpire).toHaveBeenCalledTimes(1);
    expect(onAnswer).not.toHaveBeenCalled();
  });
});
