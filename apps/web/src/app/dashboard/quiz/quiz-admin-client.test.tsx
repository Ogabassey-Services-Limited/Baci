import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QuizAdminClient } from './quiz-admin-client';

const mockApiPost = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api-client', () => ({
  apiPost: (...args: unknown[]) => mockApiPost(...args),
}));

function validGenerationResponse() {
  return {
    event: {
      id: 'event-1',
      slug: 'daily-phone-quiz',
      status: 'draft',
      title: 'Daily Phone Quiz',
    },
    questions: [
      {
        difficulty: 'standard',
        options: [
          { id: 'a', label: 'iPhone 13' },
          { id: 'b', label: 'iPhone 15' },
        ],
        prompt: 'Which iPhone model introduced USB-C?',
        topic: 'iPhone buying advice',
      },
    ],
  };
}

describe('QuizAdminClient', () => {
  beforeEach(() => {
    mockApiPost.mockReset();
  });

  it('submits topics to the Gemma generation API and shows the generated draft', async () => {
    mockApiPost.mockResolvedValue(validGenerationResponse());
    const user = userEvent.setup();

    render(<QuizAdminClient />);

    await user.clear(screen.getByLabelText(/quiz title/i));
    await user.type(screen.getByLabelText(/quiz title/i), 'Daily Phone Quiz');
    await user.clear(screen.getByLabelText(/topics/i));
    await user.type(screen.getByLabelText(/topics/i), 'iPhone buying advice');
    await user.click(screen.getByRole('button', { name: /generate draft/i }));

    await waitFor(() => expect(mockApiPost).toHaveBeenCalledOnce());
    expect(mockApiPost).toHaveBeenCalledWith('/api/merchant/quiz/generate', {
      difficulty: 'standard',
      prizeName: 'Quiz prize',
      questionCountPerTopic: 1,
      timeLimitSeconds: 30,
      title: 'Daily Phone Quiz',
      topics: ['iPhone buying advice'],
    });
    expect(
      await screen.findByText('Which iPhone model introduced USB-C?')
    ).toBeInTheDocument();
    expect(screen.getByText('Draft saved')).toBeInTheDocument();
  });

  it('shows API errors when Gemma generation fails', async () => {
    mockApiPost.mockRejectedValue(new Error('Gemma unavailable'));
    const user = userEvent.setup();

    render(<QuizAdminClient />);

    await user.click(screen.getByRole('button', { name: /generate draft/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Gemma unavailable'
    );
  });

  it('shows a validation error when the generation response is invalid', async () => {
    mockApiPost.mockResolvedValue({ event: null, questions: [] });
    const user = userEvent.setup();

    render(<QuizAdminClient />);

    await user.click(screen.getByRole('button', { name: /generate draft/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Invalid quiz generation response'
    );
  });

  it('disables the generate button while a draft is being generated', async () => {
    let resolveGeneration: ((value: unknown) => void) | undefined;
    mockApiPost.mockReturnValue(
      new Promise((resolve) => {
        resolveGeneration = resolve;
      })
    );
    const user = userEvent.setup();

    render(<QuizAdminClient />);

    const button = screen.getByRole('button', { name: /generate draft/i });
    await user.click(button);

    expect(button).toBeDisabled();
    expect(resolveGeneration).toBeDefined();
    resolveGeneration?.(validGenerationResponse());
    expect(
      await screen.findByText('Which iPhone model introduced USB-C?')
    ).toBeInTheDocument();
  });
});
