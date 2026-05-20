import { jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { QuizScreen } from '@/components/quiz/QuizScreen';
import type { QuizAttempt, QuizEvent, QuizResult } from '@/services/quiz';
import {
  fetchQuizEvents,
  startQuizAttempt,
  submitQuizAnswer,
} from '@/services/quiz';
import { useQuizStore } from '@/stores/quiz-store';

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
    jest.mocked(fetchQuizEvents).mockResolvedValue([quizEvent]);
    jest.mocked(startQuizAttempt).mockResolvedValue(quizAttempt);
    jest.mocked(submitQuizAnswer).mockResolvedValue(quizResult);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders a load error as an accessible alert', async () => {
    jest.mocked(fetchQuizEvents).mockRejectedValueOnce(new Error('Events offline'));

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

    expect(await screen.findByText('Prize Exam')).toBeTruthy();
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
    jest.mocked(fetchQuizEvents).mockResolvedValueOnce([
      { ...quizEvent, status: 'scheduled' },
    ]);

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
      screen.getByRole('button', { name: 'Answer 4' }).props
        .accessibilityState
    ).toMatchObject({ disabled: true, selected: true });
    expect(
      screen.getByRole('button', { name: 'Answer 3' }).props
        .accessibilityState
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
});
