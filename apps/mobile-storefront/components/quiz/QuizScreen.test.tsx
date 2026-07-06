import { jest } from '@jest/globals';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { QuizScreen } from '@/components/quiz/QuizScreen';
import type { QuizAttempt, QuizEvent, QuizResult } from '@/services/quiz';
import {
  fetchQuizEvents,
  startQuizAttempt,
  submitQuizAnswer,
} from '@/services/quiz';
import { useQuizStore } from '@/stores/quiz-store';

// The username gate pulls in additional modules (UsernamePrompt, the zod
// username schema, the gate modal) that add one-time mount cost to whichever
// test in this file runs first — that can push it past Jest's 5000ms default
// under load. Widen this file's timeout rather than the shared jest config.
jest.setTimeout(15000);

// Defaults to a customer that already has a username so the pre-existing
// start-flow tests below are unaffected by the username gate. The gate
// itself is covered by the dedicated test further down.
let mockUsername: string | null = 'ogafan';
const mockSetUsername =
  jest.fn<
    (
      username: string
    ) => Promise<{ success: boolean; error?: string; username?: string }>
  >();

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: (
    selector: (state: {
      customer: { username: string | null } | null;
      setUsername: typeof mockSetUsername;
    }) => unknown
  ) =>
    selector({
      customer: { username: mockUsername },
      setUsername: mockSetUsername,
    }),
}));

const quizEvent: QuizEvent = {
  endsAt: '2026-05-20T10:10:00.000Z',
  id: 'event-1',
  prizeName: 'N50,000 store credit',
  questionCount: 3,
  startsAt: '2026-05-20T10:00:00.000Z',
  status: 'open',
  title: 'Daily Prize Quiz',
};

const quizAttempt: QuizAttempt = {
  attemptId: 'attempt-1',
  eventId: 'event-1',
  examPassPointsSpent: 1,
  remainingLoyaltyPoints: 4,
  question: {
    id: 'question-1',
    index: 1,
    options: [
      { id: 'a', label: '3' },
      { id: 'b', label: '4' },
    ],
    prompt: 'What is 2 + 2?',
    timeLimitSeconds: 30,
    total: 3,
  },
};

const quizResult: QuizResult = {
  attemptId: 'attempt-1',
  correctAnswers: 1,
  prizeEligible: true,
  status: 'completed',
  totalQuestions: 3,
};

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

jest.mock('@/services/quiz', () => ({
  fetchQuizEvents: jest.fn(),
  startQuizAttempt: jest.fn(),
  submitQuizAnswer: jest.fn(),
}));

describe('QuizScreen', () => {
  beforeEach(() => {
    useQuizStore.getState().reset();
    mockUsername = 'ogafan';
    mockSetUsername.mockReset();
    jest.mocked(fetchQuizEvents).mockResolvedValue([quizEvent]);
    jest.mocked(startQuizAttempt).mockResolvedValue(quizAttempt);
    jest.mocked(submitQuizAnswer).mockResolvedValue(quizResult);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders a load error as an accessible alert', async () => {
    jest
      .mocked(fetchQuizEvents)
      .mockRejectedValueOnce(new Error('Events offline'));

    render(<QuizScreen integrityTier="device" locale="en-US" />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Events offline'
    );
    fireEvent.press(
      screen.getByRole('button', { name: 'Retry loading quiz events' })
    );

    expect(await screen.findByText('Daily Prize Quiz')).toBeTruthy();
  });

  it('renders fetched quiz events', async () => {
    render(<QuizScreen integrityTier="device" locale="en-US" />);

    expect(await screen.findByText('Super Quiz')).toBeTruthy();
    expect(
      screen.getByText('Use 1 loyalty point as your exam pass.')
    ).toBeTruthy();
    expect(
      screen.getByText('Your pass is charged when the exam starts.')
    ).toBeTruthy();
    expect(await screen.findByText('Daily Prize Quiz')).toBeTruthy();
    expect(screen.getByText('N50,000 store credit')).toBeTruthy();
    expect(
      screen.getByRole('button', {
        name: 'Use 1 point to start Daily Prize Quiz',
      })
    ).toBeTruthy();
  });

  it('disables start for scheduled quiz events', async () => {
    jest
      .mocked(fetchQuizEvents)
      .mockResolvedValueOnce([{ ...quizEvent, status: 'scheduled' }]);

    render(<QuizScreen integrityTier="device" locale="en-US" />);

    const startButton = await screen.findByRole('button', {
      name: 'Scheduled Daily Prize Quiz',
    });
    expect(screen.getByText('Scheduled')).toBeTruthy();
    expect(startButton.props.accessibilityState).toMatchObject({
      disabled: true,
    });

    fireEvent.press(startButton);
    expect(startQuizAttempt).not.toHaveBeenCalled();
  });

  it('shows a pending start state and renders the first question after start', async () => {
    const startDeferred = createDeferred<QuizAttempt>();
    jest.mocked(startQuizAttempt).mockReturnValueOnce(startDeferred.promise);
    render(<QuizScreen integrityTier="device" locale="en-US" />);

    fireEvent.press(
      await screen.findByRole('button', {
        name: 'Use 1 point to start Daily Prize Quiz',
      })
    );

    expect(await screen.findByText('Starting...')).toBeTruthy();
    expect(startQuizAttempt).toHaveBeenCalledWith({
      eventId: 'event-1',
      integrityTier: 'device',
    });

    await act(async () => {
      startDeferred.resolve(quizAttempt);
      await startDeferred.promise;
    });

    expect(await screen.findByText('What is 2 + 2?')).toBeTruthy();
    expect(screen.getByText('You have 30s per question')).toBeTruthy();
    expect(
      screen.getByText('1 point exam pass used. 4 points left.')
    ).toBeTruthy();
  });

  it('shows a pending submit state and renders a successful result', async () => {
    const submitDeferred = createDeferred<QuizResult>();
    jest.mocked(submitQuizAnswer).mockReturnValueOnce(submitDeferred.promise);
    render(<QuizScreen integrityTier="strong" locale="en-US" />);

    fireEvent.press(
      await screen.findByRole('button', {
        name: 'Use 1 point to start Daily Prize Quiz',
      })
    );
    fireEvent.press(await screen.findByRole('button', { name: 'Answer 4' }));

    const submitButton = screen.getByRole('button', { name: 'Submit answer' });
    fireEvent.press(submitButton);

    expect(
      screen.getByRole('button', { name: 'Submit answer' }).props
        .accessibilityState
    ).toMatchObject({ disabled: true });
    expect(
      screen.getByRole('button', { name: 'Answer 4' }).props.accessibilityState
    ).toMatchObject({ disabled: true, selected: true });
    expect(
      screen.getByRole('button', { name: 'Answer 3' }).props.accessibilityState
    ).toMatchObject({ disabled: true });
    expect(submitQuizAnswer).toHaveBeenCalledWith({
      answer: 'b',
      attemptId: 'attempt-1',
      integrityTier: 'strong',
      questionId: 'question-1',
    });

    await act(async () => {
      submitDeferred.resolve(quizResult);
      await submitDeferred.promise;
    });

    expect(await screen.findByText('Result')).toBeTruthy();
    expect(screen.getByText('1 of 3 correct')).toBeTruthy();
  });

  it('keeps available events reachable after a completed attempt result', async () => {
    render(<QuizScreen integrityTier="strong" locale="en-US" />);

    fireEvent.press(
      await screen.findByRole('button', {
        name: 'Use 1 point to start Daily Prize Quiz',
      })
    );
    fireEvent.press(await screen.findByRole('button', { name: 'Answer 4' }));
    fireEvent.press(screen.getByRole('button', { name: 'Submit answer' }));

    expect(await screen.findByText('Result')).toBeTruthy();
    expect(
      screen.getByRole('button', {
        name: 'Use 1 point to start Daily Prize Quiz',
      })
    ).toBeTruthy();
  });

  it('renders a start error as an accessible alert', async () => {
    jest.mocked(startQuizAttempt).mockRejectedValue(new Error('Start failed'));
    render(<QuizScreen integrityTier="device" locale="en-US" />);

    fireEvent.press(
      await screen.findByRole('button', {
        name: 'Use 1 point to start Daily Prize Quiz',
      })
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('Start failed');
    expect(
      screen.getByRole('button', {
        name: 'Use 1 point to start Daily Prize Quiz',
      })
    ).toBeTruthy();
    expect(startQuizAttempt).toHaveBeenCalledWith({
      eventId: 'event-1',
      integrityTier: 'device',
    });
  });

  it('renders a submit error as an accessible alert', async () => {
    jest.mocked(submitQuizAnswer).mockRejectedValue(new Error('Submit failed'));
    render(<QuizScreen integrityTier="strong" locale="en-US" />);

    fireEvent.press(
      await screen.findByRole('button', {
        name: 'Use 1 point to start Daily Prize Quiz',
      })
    );
    fireEvent.press(await screen.findByRole('button', { name: 'Answer 4' }));
    fireEvent.press(screen.getByRole('button', { name: 'Submit answer' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Submit failed');
    expect(screen.getByText('What is 2 + 2?')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Submit answer' })).toBeTruthy();
    expect(submitQuizAnswer).toHaveBeenCalledWith({
      answer: 'b',
      attemptId: 'attempt-1',
      integrityTier: 'strong',
      questionId: 'question-1',
    });
  });

  it('gates the quiz start behind setting a username, then starts once one is set', async () => {
    mockUsername = null;
    mockSetUsername.mockResolvedValue({ success: true, username: 'ogafan' });
    render(<QuizScreen integrityTier="device" locale="en-US" />);

    fireEvent.press(
      await screen.findByRole('button', {
        name: 'Use 1 point to start Daily Prize Quiz',
      })
    );

    expect(
      await screen.findByRole('header', {
        name: 'Choose a username to appear on the leaderboard',
      })
    ).toBeTruthy();
    expect(startQuizAttempt).not.toHaveBeenCalled();

    fireEvent.changeText(screen.getByLabelText('Username'), 'ogafan');
    fireEvent.press(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() => {
      expect(mockSetUsername).toHaveBeenCalledWith('ogafan');
    });
    await waitFor(() => {
      expect(startQuizAttempt).toHaveBeenCalledWith({
        eventId: 'event-1',
        integrityTier: 'device',
      });
    });
    expect(await screen.findByText('What is 2 + 2?')).toBeTruthy();
  });

  it('closes the username gate without starting when cancelled', async () => {
    mockUsername = null;
    render(<QuizScreen integrityTier="device" locale="en-US" />);

    fireEvent.press(
      await screen.findByRole('button', {
        name: 'Use 1 point to start Daily Prize Quiz',
      })
    );
    fireEvent.press(
      await screen.findByRole('button', { name: 'Cancel username setup' })
    );

    expect(
      screen.queryByRole('header', {
        name: 'Choose a username to appear on the leaderboard',
      })
    ).toBeNull();
    expect(startQuizAttempt).not.toHaveBeenCalled();
  });
});
