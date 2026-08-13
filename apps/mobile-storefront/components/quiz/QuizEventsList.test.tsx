import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { QuizEventsList } from './QuizEventsList';
import { createQuizLobbyStyles } from './QuizLobby.styles';
import type { QuizThemeColors } from './QuizScreen.styles';

jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'LinearGradient' }));
jest.mock('@react-native-vector-icons/ionicons', () => 'Ionicons');

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
            status: 'active',
            questionCount: 10,
            mode: 'test',
            timePerQuestionSeconds: 10,
            timeZone: 'Africa/Lagos',
          },
        ]}
        isStarting={false}
        onStart={onStart}
        styles={createQuizLobbyStyles(themeColors)}
      />
    );

    expect(screen.getByTestId('quiz-gadget-pattern-background')).toBeTruthy();
    expect(screen.getByText("OGABASSEY'S SUPERQUIZ")).toBeTruthy();
    expect(screen.getByText('Play for more than the prize.')).toBeTruthy();
    expect(screen.getByText(/within reach of more Nigerians/i)).toBeTruthy();
    expect(screen.getByText(/close the digital divide/i)).toBeTruthy();

    fireEvent.press(screen.getByLabelText(/Play for free Open Quiz/i));
    expect(screen.getByRole('header', { name: 'How to play' })).toBeTruthy();
    fireEvent.press(
      screen.getByRole('checkbox', { name: 'Accept quiz rules and terms' })
    );
    fireEvent.press(
      screen.getByRole('button', { name: 'Accept and play quiz' })
    );

    expect(onStart).toHaveBeenCalledWith('event-1', true);
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
        styles={createQuizLobbyStyles(themeColors)}
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

  it('keeps the programme purpose visible when no quiz is available', () => {
    render(
      <QuizEventsList
        events={[]}
        isStarting={false}
        onStart={jest.fn()}
        styles={createQuizLobbyStyles(themeColors)}
      />
    );

    expect(screen.getByText("OGABASSEY'S SUPERQUIZ")).toBeTruthy();
    expect(screen.getByText('No quiz events available.')).toBeTruthy();
  });
});
