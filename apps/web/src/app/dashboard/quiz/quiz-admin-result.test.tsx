import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { QuizAdminResult } from './quiz-admin-result';

function draftResult() {
  return {
    event: {
      id: 'event-1',
      slug: 'daily-phone-quiz',
      status: 'draft',
      title: 'Daily Phone Quiz',
    },
    questions: [
      {
        correctOptionId: 'a',
        difficulty: 'standard' as const,
        explanation: 'Newer Android phones ship with USB-C.',
        options: [
          { id: 'a', label: 'USB-C' },
          { id: 'b', label: 'Micro-USB' },
        ],
        prompt: 'Which charging port is common on newer Android phones?',
        topic: 'Android buying advice',
      },
    ],
  };
}

describe('QuizAdminResult', () => {
  it('shows the AI-marked correct answer and explanation for a draft', () => {
    render(<QuizAdminResult result={draftResult()} />);

    expect(screen.getByText('Draft saved')).toBeInTheDocument();
    expect(
      screen.getByText('Which charging port is common on newer Android phones?')
    ).toBeInTheDocument();
    expect(screen.getAllByText('Correct').length).toBeGreaterThan(0);
    expect(
      screen.getByText(/Newer Android phones ship with USB-C\./)
    ).toBeInTheDocument();
  });

  it('resets the review confirmation when a NEW draft is rendered', async () => {
    // The confirmation is per draft: a checkbox ticked for draft A must not
    // pre-authorize opening a subsequently generated draft B.
    const user = userEvent.setup();
    const { rerender } = render(
      <QuizAdminResult onActivate={vi.fn()} result={draftResult()} />
    );

    await user.click(
      screen.getByRole('checkbox', { name: /reviewed every correct answer/i })
    );
    expect(screen.getByRole('button', { name: /open now/i })).toBeEnabled();

    const nextDraft = draftResult();
    nextDraft.event = { ...nextDraft.event, id: 'event-2', title: 'New Draft' };
    rerender(<QuizAdminResult onActivate={vi.fn()} result={nextDraft} />);

    expect(
      screen.getByRole('checkbox', { name: /reviewed every correct answer/i })
    ).not.toBeChecked();
    expect(screen.getByRole('button', { name: /open now/i })).toBeDisabled();
  });

  it('gates the open action behind an explicit review confirmation', async () => {
    const onActivate = vi.fn();
    const user = userEvent.setup();

    render(<QuizAdminResult onActivate={onActivate} result={draftResult()} />);

    const openButton = screen.getByRole('button', { name: /open now/i });
    expect(openButton).toBeDisabled();

    await user.click(
      screen.getByRole('checkbox', { name: /reviewed every correct answer/i })
    );
    expect(openButton).toBeEnabled();

    await user.click(openButton);
    expect(onActivate).toHaveBeenCalledOnce();
  });

  it('renders a live state without the open action once active', () => {
    render(
      <QuizAdminResult
        result={{
          ...draftResult(),
          event: { ...draftResult().event, status: 'active' },
        }}
      />
    );

    expect(screen.getByText('Quiz open')).toBeInTheDocument();
    expect(screen.getByText('Status: active')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /open now/i })
    ).not.toBeInTheDocument();
  });
});
