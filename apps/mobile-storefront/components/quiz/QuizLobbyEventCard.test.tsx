import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { createQuizLobbyStyles } from './QuizLobby.styles';
import { QuizLobbyEventCard } from './QuizLobbyEventCard';
import type { QuizThemeColors } from './QuizScreen.styles';

jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('@react-native-vector-icons/ionicons', () => 'Ionicons');

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

describe('QuizLobbyEventCard', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders the product spotlight and universal close timing once', () => {
    const onOpenRules = jest.fn();
    render(
      <QuizLobbyEventCard
        event={{
          endsAt: '2026-08-03T20:05:00Z',
          id: 'event-1',
          mode: 'test',
          prizeName: 'iPhone XR',
          questionCount: 20,
          prizeProduct: {
            condition: 'open_box',
            id: 'p1',
            imageUrl: 'https://example.com/xr.png',
            name: 'iPhone XR',
            variantId: null,
          },
          startsAt: '2026-08-03T20:00:00Z',
          status: 'active',
          timePerQuestionSeconds: 10,
          timeZone: 'Africa/Lagos',
          title: 'Redmi Warriors',
        }}
        isResume={false}
        isStarting={false}
        onOpenRules={onOpenRules}
        onResume={jest.fn()}
        serverNow="2026-08-03T20:04:30Z"
        styles={createQuizLobbyStyles(colors)}
      />
    );

    expect(screen.getByText('Win iPhone XR')).toBeTruthy();
    expect(screen.getByText("Tonight's Prize")).toBeTruthy();
    expect(screen.getByText('open box')).toBeTruthy();
    expect(screen.getByText('20 questions')).toBeTruthy();
    expect(screen.getByText('10s each')).toBeTruthy();
    expect(screen.getByText('until quiz ends')).toBeTruthy();
    expect(screen.queryByText('until entries close')).toBeNull();
    fireEvent.press(
      screen.getByRole('button', { name: 'Play for free Redmi Warriors' })
    );
    expect(onOpenRules).toHaveBeenCalledWith(true);
  });

  it('resumes without requesting another acceptance gate', () => {
    const onOpenRules = jest.fn();
    const onResume = jest.fn();
    render(
      <QuizLobbyEventCard
        event={{
          endsAt: null,
          id: 'event-1',
          prizeName: 'Phone',
          questionCount: 5,
          startsAt: null,
          status: 'active',
          title: 'Live quiz',
        }}
        isResume
        isStarting={false}
        onOpenRules={onOpenRules}
        onResume={onResume}
        styles={createQuizLobbyStyles(colors)}
      />
    );
    fireEvent.press(
      screen.getByRole('button', { name: 'Resume quiz Live quiz' })
    );
    expect(onOpenRules).not.toHaveBeenCalled();
    expect(onResume).toHaveBeenCalledTimes(1);
  });

  it('closes the card immediately when its countdown reaches zero', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-09T18:00:00.000Z'));

    render(
      <QuizLobbyEventCard
        event={{
          endsAt: '2026-08-09T18:00:01.000Z',
          id: 'event-expiring',
          mode: 'test',
          prizeName: 'iPhone XR',
          questionCount: 5,
          startsAt: '2026-08-09T17:50:00.000Z',
          status: 'active',
          timePerQuestionSeconds: 10,
          timeZone: 'Africa/Lagos',
          title: 'Expiring quiz',
        }}
        isResume={false}
        isStarting={false}
        onOpenRules={jest.fn()}
        onResume={jest.fn()}
        serverNow="2026-08-09T18:00:00.000Z"
        styles={createQuizLobbyStyles(colors)}
      />
    );

    expect(
      screen.getByRole('button', { name: 'Play for free Expiring quiz' })
    ).toBeTruthy();

    act(() => jest.advanceTimersByTime(1000));

    expect(screen.queryByText('until quiz ends')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Closed Expiring quiz' }).props
        .accessibilityState
    ).toEqual({ disabled: true });
  });
});
