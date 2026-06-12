import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { QuizQuestionAdFallback } from './quiz-question-ad-fallback';

describe('QuizQuestionAdFallback', () => {
  it('exposes a semantic sponsored placement region', () => {
    render(<QuizQuestionAdFallback />);

    expect(
      screen.getByRole('region', {
        name: 'Reserved sponsored quiz placement',
      })
    ).toHaveTextContent('Sponsored');
  });
});
