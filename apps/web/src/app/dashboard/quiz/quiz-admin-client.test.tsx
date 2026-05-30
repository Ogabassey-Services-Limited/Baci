import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QuizAdminClient } from './quiz-admin-client';

const mockApiPost = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api-client', () => ({
  apiPost: (...args: unknown[]) => mockApiPost(...args),
}));

const PRIZE_PRODUCT_ID = '55555555-5555-4555-8555-555555555555';
const prizeProducts = [
  {
    defaultVariantId: null,
    id: PRIZE_PRODUCT_ID,
    imageUrl: 'https://cdn.example.com/iphone-15-pro-max.png',
    name: 'iPhone 15 Pro Max',
    price: 2100000,
  },
];

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

  function renderQuizAdminClient(
    props: Partial<Parameters<typeof QuizAdminClient>[0]> = {}
  ) {
    return render(
      <QuizAdminClient
        initialPrizeProducts={props.initialPrizeProducts ?? prizeProducts}
        initialPrizeProductsError={props.initialPrizeProductsError ?? null}
      />
    );
  }

  it('submits topics and the selected prize product to the Gemma generation API', async () => {
    mockApiPost.mockResolvedValue(validGenerationResponse());
    const user = userEvent.setup();

    renderQuizAdminClient();

    expect(await screen.findByLabelText(/prize product/i)).toHaveValue(
      PRIZE_PRODUCT_ID
    );
    await user.clear(screen.getByLabelText(/quiz title/i));
    await user.type(screen.getByLabelText(/quiz title/i), 'Daily Phone Quiz');
    await user.clear(screen.getByLabelText(/topics/i));
    await user.type(screen.getByLabelText(/topics/i), 'iPhone buying advice');
    await user.click(screen.getByRole('button', { name: /generate draft/i }));

    await waitFor(() => expect(mockApiPost).toHaveBeenCalledOnce());
    expect(mockApiPost).toHaveBeenCalledWith('/api/merchant/quiz/generate', {
      difficulty: 'standard',
      prizeProductId: PRIZE_PRODUCT_ID,
      publicationMode: 'draft',
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

  it('can ask the API to open the generated quiz immediately', async () => {
    mockApiPost.mockResolvedValue({
      ...validGenerationResponse(),
      event: { ...validGenerationResponse().event, status: 'active' },
    });
    const user = userEvent.setup();

    renderQuizAdminClient();

    await screen.findByLabelText(/prize product/i);
    await user.selectOptions(screen.getByLabelText(/publish/i), 'active');
    await user.click(
      screen.getByRole('button', { name: /generate and open/i })
    );

    await waitFor(() => expect(mockApiPost).toHaveBeenCalledOnce());
    expect(mockApiPost).toHaveBeenCalledWith(
      '/api/merchant/quiz/generate',
      expect.objectContaining({ publicationMode: 'active' })
    );
    expect(await screen.findByText('Quiz open')).toBeInTheDocument();
    expect(screen.getByText('Status: active')).toBeInTheDocument();
  });

  it('shows API errors when Gemma generation fails', async () => {
    mockApiPost.mockRejectedValue(new Error('Gemma unavailable'));
    const user = userEvent.setup();

    renderQuizAdminClient();

    await screen.findByLabelText(/prize product/i);
    await user.click(screen.getByRole('button', { name: /generate draft/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Gemma unavailable'
    );
  });

  it('shows a validation error when the generation response is invalid', async () => {
    mockApiPost.mockResolvedValue({ event: null, questions: [] });
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const user = userEvent.setup();

    renderQuizAdminClient();

    await screen.findByLabelText(/prize product/i);
    await user.click(screen.getByRole('button', { name: /generate draft/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Invalid quiz generation response:'
    );
    expect(consoleError).toHaveBeenCalledWith(
      'Invalid quiz generation response',
      expect.any(Error)
    );
    consoleError.mockRestore();
  });

  it('prevents submission when no topics are provided', async () => {
    const user = userEvent.setup();

    renderQuizAdminClient();

    await screen.findByLabelText(/prize product/i);
    const topics = screen.getByLabelText(/topics/i);
    await user.clear(topics);

    expect(
      screen.getByRole('button', { name: /generate draft/i })
    ).toBeDisabled();
    expect(mockApiPost).not.toHaveBeenCalled();
  });

  it('disables the generate button while a draft is being generated', async () => {
    let resolveGeneration: ((value: unknown) => void) | undefined;
    mockApiPost.mockReturnValue(
      new Promise((resolve) => {
        resolveGeneration = resolve;
      })
    );
    const user = userEvent.setup();

    renderQuizAdminClient();

    await screen.findByLabelText(/prize product/i);
    const button = screen.getByRole('button', { name: /generate draft/i });
    await user.click(button);

    expect(button).toBeDisabled();
    expect(resolveGeneration).toBeDefined();
    resolveGeneration?.(validGenerationResponse());
    expect(
      await screen.findByText('Which iPhone model introduced USB-C?')
    ).toBeInTheDocument();
  });

  it('requires an active product before generating a quiz', async () => {
    renderQuizAdminClient({ initialPrizeProducts: [] });

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Add an active product before creating a prize quiz.'
    );
    expect(
      screen.getByRole('button', { name: /generate draft/i })
    ).toBeDisabled();
  });
});
