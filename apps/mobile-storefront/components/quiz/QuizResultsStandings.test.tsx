import { render, screen } from '@testing-library/react-native';
import type { QuizLeaderboard } from '@/services/quiz-types';
import { QuizResultsStandings } from './QuizResultsStandings';
import { createQuizStyles, type QuizThemeColors } from './QuizScreen.styles';

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

describe('QuizResultsStandings', () => {
  it('renders participant count and the current player row', () => {
    const leaderboard: QuizLeaderboard = {
      currentPlayer: {
        displayName: 'Bassey',
        isCurrentCustomer: true,
        rank: 2,
        score: 8,
        status: 'completed',
        submittedAt: null,
        totalTimeSeconds: 12,
      },
      entries: [],
      participantCount: 4,
      status: 'published',
    };

    render(
      <QuizResultsStandings
        leaderboard={leaderboard}
        leaderboardError={false}
        participantCount={4}
        styles={createQuizStyles(colors)}
      />
    );

    expect(screen.getByText('Final standings')).toBeTruthy();
    expect(screen.getByText('4 participants')).toBeTruthy();
    expect(screen.getByText('Bassey  (You)')).toBeTruthy();
  });
});
