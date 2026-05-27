import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { QuizAdminResult } from './quiz-admin-result';

const result = {
  event: {
    id: 'event-1',
    slug: 'daily-phone-quiz',
    status: 'active',
    title: 'Daily Phone Quiz',
  },
  questions: [
    {
      difficulty: 'standard' as const,
      options: [
        { id: 'a', label: 'USB-C' },
        { id: 'b', label: 'Micro-USB' },
      ],
      prompt: 'Which charging port is common on newer Android phones?',
      topic: 'Android buying advice',
    },
  ],
};

describe('QuizAdminResult', () => {
  it('renders opened quiz status and generated questions', () => {
    render(<QuizAdminResult result={result} />);

    expect(screen.getByText('Quiz open')).toBeInTheDocument();
    expect(screen.getByText('Status: active')).toBeInTheDocument();
    expect(
      screen.getByText('Which charging port is common on newer Android phones?')
    ).toBeInTheDocument();
    expect(screen.getByText('a. USB-C')).toBeInTheDocument();
  });
});
