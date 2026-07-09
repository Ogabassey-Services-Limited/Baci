import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { QuestionReview } from './quiz-question-review';

describe('QuestionReview', () => {
  it('marks the answer key and displays its explanation', () => {
    render(
      <QuestionReview
        position={2}
        question={{
          correctOptionId: 'b',
          difficulty: 'standard',
          explanation: 'USB-C supports the relevant charging standard.',
          options: [
            { id: 'a', label: 'Micro-USB' },
            { id: 'b', label: 'USB-C' },
          ],
          prompt: 'Which port is the right answer?',
          topic: 'Phone buying advice',
        }}
      />
    );

    expect(
      screen.getByText('Phone buying advice - Question 2')
    ).toBeInTheDocument();
    expect(screen.getByText('b. USB-C')).toBeInTheDocument();
    expect(screen.getByText('Correct')).toBeInTheDocument();
    expect(
      screen.getByText('USB-C supports the relevant charging standard.')
    ).toBeInTheDocument();
  });
});
