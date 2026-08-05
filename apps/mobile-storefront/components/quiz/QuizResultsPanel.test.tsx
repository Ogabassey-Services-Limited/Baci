import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { QuizResultsPanel } from './QuizResultsPanel';
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

describe('QuizResultsPanel', () => {
  it('explains that terminal answers are saved while results finalize', () => {
    render(
      <QuizResultsPanel
        legacyResult={null}
        lifecycle="pending_results"
        styles={createQuizStyles(colors)}
        v2Result={{
          attemptId: 'a1',
          availability: 'pending',
          availableAt: null,
        }}
      />
    );
    expect(screen.getByText('Results are being finalized')).toBeTruthy();
    expect(screen.getByText(/answers are saved/i)).toBeTruthy();
  });
});
