import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { QuizAttemptResponse } from '@/schemas/quiz';
import { QuizQuestionPanel } from './quiz-question-panel';

const mockUseQuizCountdown = vi.hoisted(() => vi.fn());

vi.mock('./use-quiz-countdown', () => ({
  useQuizCountdown: (...args: unknown[]) => mockUseQuizCountdown(...args),
}));

vi.mock('../components/deferred-ad-unit', () => ({
  DeferredAdUnit: ({ fallback }: { fallback?: ReactNode }) => (
    <div data-testid="quiz-question-ad">{fallback}</div>
  ),
}));

function buildAttempt(): QuizAttemptResponse {
  return {
    attemptId: 'attempt-1',
    eventId: 'event-1',
    examPassPointsSpent: 1,
    question: {
      id: 'question-1',
      index: 2,
      options: [
        { id: 'a', label: 'iPhone 13' },
        { id: 'b', label: 'iPhone 15' },
      ],
      prompt: 'Which iPhone model introduced USB-C?',
      timeLimitSeconds: 30,
      total: 5,
    },
    remainingLoyaltyPoints: 40,
  };
}

function renderPanel(
  overrides: Partial<Parameters<typeof QuizQuestionPanel>[0]> = {}
) {
  const props = {
    attempt: buildAttempt(),
    isSubmitting: false,
    onAutoSubmit: vi.fn(),
    onSelect: vi.fn(),
    onSubmit: vi.fn(),
    selectedAnswer: null,
    ...overrides,
  };
  render(<QuizQuestionPanel {...props} />);
  return props;
}

describe('QuizQuestionPanel', () => {
  beforeEach(() => {
    mockUseQuizCountdown.mockReturnValue(18);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders the countdown, prompt, options and progress for the current question', () => {
    renderPanel();

    expect(screen.getByText('18s remaining')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        name: 'Which iPhone model introduced USB-C?',
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'iPhone 13' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'iPhone 15' })
    ).toBeInTheDocument();

    const progressbar = screen.getByRole('progressbar', {
      name: 'Question 2 of 5',
    });
    expect(progressbar).toHaveAttribute('aria-valuenow', '2');
    expect(progressbar).toHaveAttribute('aria-valuemax', '5');
  });

  it('invokes onSelect with the chosen option id and reflects the selection via aria-pressed', () => {
    const { onSelect } = renderPanel({ selectedAnswer: 'b' });

    const selectedOption = screen.getByRole('button', { name: 'iPhone 15' });
    expect(selectedOption).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'iPhone 13' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );

    expect(onSelect).not.toHaveBeenCalled();
  });

  it('calls onSelect when an option is clicked', async () => {
    const user = userEvent.setup();
    const { onSelect } = renderPanel();

    await user.click(screen.getByRole('button', { name: 'iPhone 13' }));

    expect(onSelect).toHaveBeenCalledWith('a');
  });

  it('keeps the submit button disabled until an answer is selected', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderPanel();

    const submit = screen.getByRole('button', { name: 'Submit answer' });
    expect(submit).toBeDisabled();

    await user.click(submit);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('enables and fires onSubmit once an answer is selected', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderPanel({ selectedAnswer: 'b' });

    const submit = screen.getByRole('button', { name: 'Submit answer' });
    expect(submit).toBeEnabled();

    await user.click(submit);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('announces the remaining time in the live region only inside the final seconds', () => {
    mockUseQuizCountdown.mockReturnValue(4);
    const { container } = render(
      <QuizQuestionPanel
        attempt={buildAttempt()}
        isSubmitting={false}
        onAutoSubmit={vi.fn()}
        onSelect={vi.fn()}
        onSubmit={vi.fn()}
        selectedAnswer={null}
      />
    );

    const liveRegion = container.querySelector('[aria-live="assertive"]');
    expect(liveRegion).toHaveTextContent('4 seconds remaining');
  });

  it('disables options and shows the submitting state while a submission is in flight', () => {
    renderPanel({ isSubmitting: true, selectedAnswer: 'b' });

    expect(screen.getByRole('button', { name: 'iPhone 13' })).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Submitting...' })
    ).toBeDisabled();
  });
});
