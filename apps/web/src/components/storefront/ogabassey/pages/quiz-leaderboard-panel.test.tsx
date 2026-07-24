import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { QuizLeaderboardEntry } from '@/schemas/quiz-leaderboard';
import { QuizLeaderboardPanel } from './quiz-leaderboard-panel';

function entry(overrides: Partial<QuizLeaderboardEntry> = {}): QuizLeaderboardEntry {
  return {
    displayName: 'quizking',
    isCurrentCustomer: false,
    rank: 1,
    score: 5,
    status: 'scored',
    submittedAt: '2026-07-14T09:00:00.000Z',
    totalTimeSeconds: 30.5,
    ...overrides,
  };
}

describe('QuizLeaderboardPanel', () => {
  it('shows a loading state', () => {
    render(<QuizLeaderboardPanel entries={[]} isLoading error={null} />);

    expect(screen.getByText(/loading the leaderboard/i)).toBeInTheDocument();
  });

  it('shows an error as an alert', () => {
    render(
      <QuizLeaderboardPanel
        entries={[]}
        isLoading={false}
        error="Could not load the leaderboard."
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Could not load the leaderboard.'
    );
  });

  it('shows an empty state when there are no scores yet', () => {
    render(<QuizLeaderboardPanel entries={[]} isLoading={false} error={null} />);

    expect(screen.getByText(/no scores yet/i)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('renders ranked rows with score and completion time', () => {
    render(
      <QuizLeaderboardPanel
        entries={[
          entry({ displayName: 'first', rank: 1, score: 5, totalTimeSeconds: 30.5 }),
          entry({ displayName: 'second', rank: 2, score: 4, totalTimeSeconds: 41 }),
        ]}
        isLoading={false}
        error={null}
      />
    );

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('first')).toBeInTheDocument();
    expect(screen.getByText('30.5s')).toBeInTheDocument();
    expect(screen.getByText('41.0s')).toBeInTheDocument();
  });

  it('marks the signed-in player row', () => {
    render(
      <QuizLeaderboardPanel
        entries={[entry({ displayName: 'me', isCurrentCustomer: true })]}
        isLoading={false}
        error={null}
      />
    );

    expect(screen.getByText('(you)')).toBeInTheDocument();
  });

  it('renders a dash for an entry with no completion time', () => {
    render(
      <QuizLeaderboardPanel
        entries={[entry({ totalTimeSeconds: null })]}
        isLoading={false}
        error={null}
      />
    );

    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('never renders loyalty points — standings are skill and speed only', () => {
    const { container } = render(
      <QuizLeaderboardPanel
        entries={[entry()]}
        isLoading={false}
        error={null}
      />
    );

    expect(container.textContent?.toLowerCase()).not.toContain('loyalty');
    expect(container.textContent?.toLowerCase()).not.toContain('point');
  });
});
