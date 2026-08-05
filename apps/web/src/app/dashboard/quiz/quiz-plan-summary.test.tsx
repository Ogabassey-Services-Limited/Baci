import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { QuizPlanSummary } from './quiz-plan-summary';

describe('QuizPlanSummary', () => {
  it('distinguishes expected play from the universal close', () => {
    render(
      <QuizPlanSummary
        closesAt="9:05 AM"
        questionCount={20}
        timePerQuestionSeconds={10}
      />
    );
    expect(screen.getByText(/Expected play: 3m 20s/)).toBeInTheDocument();
    expect(screen.getByText(/Universal close: 9:05 AM/)).toBeInTheDocument();
  });
});
