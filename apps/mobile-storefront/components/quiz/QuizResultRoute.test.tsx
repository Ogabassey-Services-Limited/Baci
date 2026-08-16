import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { QuizResultRoute } from './QuizResultRoute';
import { createQuizStyles } from './QuizScreen.styles';

jest.mock('./QuizResultsPanel', () => ({
  QuizResultsPanel: ({
    allowPendingResultsExit,
    onReturnToQuizList,
  }: {
    allowPendingResultsExit: boolean;
    onReturnToQuizList: () => void;
  }) => {
    const React = jest.requireActual('react') as typeof import('react');
    const { Button, Text } = jest.requireActual(
      'react-native'
    ) as typeof import('react-native');
    return React.createElement(
      React.Fragment,
      null,
      React.createElement(Text, null, String(allowPendingResultsExit)),
      React.createElement(Button, {
        onPress: onReturnToQuizList,
        title: 'return',
      })
    );
  },
}));

const styles = createQuizStyles({
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
});

describe('QuizResultRoute', () => {
  it('dismisses the retained result only when another attempt is available', () => {
    const dismissRecovery = jest.fn();
    const onReset = jest.fn();
    const onRetryRecovery = jest.fn();
    render(
      <QuizResultRoute
        dismissRecovery={dismissRecovery}
        events={[
          {
            endsAt: '2026-08-16T12:05:00.000Z',
            id: 'event-1',
            maxAttempts: 2,
            prizeName: 'Phone',
            questionCount: 1,
            startsAt: '2026-08-16T12:00:00.000Z',
            status: 'active',
            title: 'Retryable quiz',
          },
        ]}
        expectedUserId="user-1"
        lifecycle="pending_results"
        onReset={onReset}
        onRetryRecovery={onRetryRecovery}
        result={null}
        styles={styles}
        terminalContext={{
          attemptId: 'attempt-1',
          eventEndsAt: '2026-08-16T12:05:00.000Z',
          eventId: 'event-1',
          serverNow: '2026-08-16T12:04:00.000Z',
          contractVersion: 2,
        }}
        v2Result={{
          attemptId: 'attempt-1',
          availability: 'pending',
          availableAt: null,
        }}
      />
    );

    expect(screen.getByText('true')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'return' }));
    expect(dismissRecovery).toHaveBeenCalledWith('event-1');
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(onRetryRecovery).toHaveBeenCalledTimes(1);
  });
});
