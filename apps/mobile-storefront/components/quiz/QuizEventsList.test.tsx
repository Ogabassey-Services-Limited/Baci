import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { QuizEventsList } from './QuizEventsList';
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

describe('QuizEventsList', () => {
  it('renders open events and triggers start callback', () => {
    const onStart = jest.fn();
    render(
      <QuizEventsList
        events={[
          {
            id: 'event-1',
            title: 'Open Quiz',
            prizeName: 'Smartphone',
            startsAt: null,
            endsAt: null,
            status: 'open',
            questionCount: 10,
          },
        ]}
        isStarting={false}
        onStart={onStart}
        styles={createQuizStyles(themeColors)}
        timeNotSetLabel="Time not set"
      />
    );

    fireEvent.press(screen.getByLabelText(/Start free exam Open Quiz/i));

    expect(onStart).toHaveBeenCalledWith('event-1');
  });

  it('disables non-open events', () => {
    const onStart = jest.fn();
    render(
      <QuizEventsList
        events={[
          {
            id: 'event-2',
            title: 'Scheduled Quiz',
            prizeName: 'Tablet',
            startsAt: null,
            endsAt: null,
            status: 'scheduled',
            questionCount: 5,
          },
        ]}
        isStarting={false}
        onStart={onStart}
        styles={createQuizStyles(themeColors)}
        timeNotSetLabel="Time not set"
      />
    );

    expect(
      screen.getByLabelText('Scheduled Scheduled Quiz').props.accessibilityState
    ).toEqual({
      disabled: true,
    });
    fireEvent.press(screen.getByLabelText('Scheduled Scheduled Quiz'));
    expect(onStart).not.toHaveBeenCalled();
  });
});
