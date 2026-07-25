import { jest } from '@jest/globals';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { QuizScreen } from '@/components/quiz/QuizScreen';
import { getQuizDeviceFingerprint } from '@/lib/get-quiz-device-fingerprint';
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
// Start-flow tests default to an adult DOB so the 18+ gate passes; the
// dedicated date-of-birth gate tests below set it to null.
let mockDateOfBirth: string | null = '1990-06-15';
const mockSetUsername =
  jest.fn<
    (
      username: string
    ) => Promise<{ success: boolean; error?: string; username?: string }>
  >();
const mockSetDateOfBirth =
  jest.fn<
    (
      dateOfBirth: string
    ) => Promise<{ success: boolean; error?: string; dateOfBirth?: string }>
  >();

jest.mock('@/stores/auth-store', () => {
  const getState = () => ({
    customer: {
      id: 'customer-1',
      username: mockUsername,
      date_of_birth: mockDateOfBirth,
    },
    setUsername: mockSetUsername,
    setDateOfBirth: mockSetDateOfBirth,
    // useQuizStartFlow reads getState().user?.id to guard against account
    // switches, so the mock must expose the static getState method too.
    user: { id: 'quiz-shopper' },
  });
  const useAuthStore = (
    selector: (state: ReturnType<typeof getState>) => unknown
  ) => selector(getState());
  useAuthStore.getState = getState;
  return { useAuthStore };
});

// The date-of-birth gate transitively renders DateTimePickerField, which
// imports the native picker. Mock it so the module resolves and a tapped field
// yields a fixed, valid past date (1990-05-23).
type MockDateTimePickerProps = {
  onChange: (event: { type: 'set' }, date: Date) => void;
};
jest.mock('@react-native-community/datetimepicker', () => ({
  __esModule: true,
  default: ({ onChange }: MockDateTimePickerProps) => {
    const { Pressable, Text } =
      jest.requireActual<typeof import('react-native')>('react-native');
    return (
      <Pressable
        accessibilityLabel="mock-date-picker"
        accessibilityRole="button"
        onPress={() => onChange({ type: 'set' }, new Date(1990, 4, 23))}
      >
        <Text>mock picker</Text>
      </Pressable>
    );
  },
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

const createFutureDeadline = (secondsFromNow: number) =>
  new Date(Date.now() + secondsFromNow * 1000).toISOString();

// Entry is free, so a fresh attempt spends nothing. Overridable so the
// deploy-window case (a stale database that still charged) can be exercised.
const createQuizAttempt = (
  overrides: Partial<QuizAttempt> = {}
): QuizAttempt => ({
  attemptId: 'attempt-1',
  eventId: 'event-1',
  examPassPointsSpent: 0,
  remainingLoyaltyPoints: 5,
  question: {
    deadlineAt: createFutureDeadline(30),
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
  ...overrides,
});

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

// Anti multi-accounting: QuizScreen sends a device fingerprint so the server can
// share one attempt budget across every account started from this device.
jest.mock('@/lib/get-quiz-device-fingerprint', () => ({
  getQuizDeviceFingerprint: jest.fn(async () => 'a'.repeat(64)),
}));

jest.mock('@/services/quiz', () => ({
  fetchQuizEvents: jest.fn(),
  startQuizAttempt: jest.fn(),
  submitQuizAnswer: jest.fn(),
}));

describe('QuizScreen', () => {
  beforeEach(() => {
    useQuizStore.getState().reset();
    mockUsername = 'ogafan';
    mockDateOfBirth = '1990-06-15';
    mockSetUsername.mockReset();
    mockSetDateOfBirth.mockReset();
    jest.mocked(fetchQuizEvents).mockResolvedValue([quizEvent]);
    jest
      .mocked(startQuizAttempt)
      .mockImplementation(async () => createQuizAttempt());
    jest.mocked(submitQuizAnswer).mockResolvedValue(quizResult);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // This is the first render in the file, so it absorbs React Native's one-time
  // cold-start cost. Under `jest --runInBand` memory pressure (560+ suites) that
  // can exceed the default 5s per-test timeout even though the flow itself is
  // instant, so the first test gets extra headroom (see jest.setup.ts note on
  // the same accumulated-pressure effect widening asyncUtilTimeout).
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
  }, 15_000);

  it('renders fetched quiz events', async () => {
    render(<QuizScreen integrityTier="device" locale="en-US" />);

    expect(await screen.findByText('Super Quiz')).toBeTruthy();
    expect(screen.getByText('Free to enter.')).toBeTruthy();
    expect(
      screen.getByText('No loyalty points required. No purchase necessary.')
    ).toBeTruthy();
    expect(await screen.findByText('Daily Prize Quiz')).toBeTruthy();
    expect(screen.getByText('N50,000 store credit')).toBeTruthy();
    expect(
      screen.getByRole('button', {
        name: 'Start free exam Daily Prize Quiz',
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
        name: 'Start free exam Daily Prize Quiz',
      })
    );

    expect(await screen.findByText('Starting...')).toBeTruthy();
    expect(startQuizAttempt).toHaveBeenCalledWith({
      deviceFingerprint: 'a'.repeat(64),
      eventId: 'event-1',
      expectedUserId: 'quiz-shopper',
      integrityTier: 'device',
    });

    await act(async () => {
      startDeferred.resolve(createQuizAttempt());
      await startDeferred.promise;
    });

    expect(await screen.findByText('What is 2 + 2?')).toBeTruthy();
    expect(screen.getByText('Time left: 30s')).toBeTruthy();
    expect(
      screen.getByText('Free entry — no loyalty points used.')
    ).toBeTruthy();
  });

  it('enters the pending state before device fingerprint lookup resolves', async () => {
    const fingerprintDeferred = createDeferred<string>();
    jest
      .mocked(getQuizDeviceFingerprint)
      .mockReturnValueOnce(fingerprintDeferred.promise);
    render(<QuizScreen integrityTier="device" locale="en-US" />);

    fireEvent.press(
      await screen.findByRole('button', {
        name: 'Start free exam Daily Prize Quiz',
      })
    );

    expect(await screen.findByText('Starting...')).toBeTruthy();
    expect(startQuizAttempt).not.toHaveBeenCalled();

    await act(async () => {
      fingerprintDeferred.resolve('c'.repeat(64));
      await fingerprintDeferred.promise;
    });

    await waitFor(() =>
      expect(startQuizAttempt).toHaveBeenCalledWith({
        deviceFingerprint: 'c'.repeat(64),
        eventId: 'event-1',
        expectedUserId: 'quiz-shopper',
        integrityTier: 'device',
      })
    );
  });

  // Deploy-window safety: an installed build can briefly talk to a database that
  // has not applied the free-entry migration and still charged a point. The
  // receipt must report what actually happened, not a hard-coded "free".
  it('reports a real charge when a stale database still spent a point', async () => {
    const startDeferred = createDeferred<QuizAttempt>();
    jest.mocked(startQuizAttempt).mockReturnValueOnce(startDeferred.promise);
    render(<QuizScreen integrityTier="device" locale="en-US" />);

    fireEvent.press(
      await screen.findByRole('button', {
        name: 'Start free exam Daily Prize Quiz',
      })
    );

    await act(async () => {
      startDeferred.resolve(
        createQuizAttempt({ examPassPointsSpent: 1, remainingLoyaltyPoints: 4 })
      );
      await startDeferred.promise;
    });

    expect(
      await screen.findByText('1 loyalty point used. 4 left.')
    ).toBeTruthy();
    expect(
      screen.queryByText('Free entry — no loyalty points used.')
    ).toBeNull();
  });

  it('shows a pending submit state and renders a successful result', async () => {
    const submitDeferred = createDeferred<QuizResult>();
    jest.mocked(submitQuizAnswer).mockReturnValueOnce(submitDeferred.promise);
    render(<QuizScreen integrityTier="strong" locale="en-US" />);

    fireEvent.press(
      await screen.findByRole('button', {
        name: 'Start free exam Daily Prize Quiz',
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
      clientAnsweredAt: expect.any(String),
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
        name: 'Start free exam Daily Prize Quiz',
      })
    );
    fireEvent.press(await screen.findByRole('button', { name: 'Answer 4' }));
    fireEvent.press(screen.getByRole('button', { name: 'Submit answer' }));

    expect(await screen.findByText('Result')).toBeTruthy();
    expect(
      screen.getByRole('button', {
        name: 'Start free exam Daily Prize Quiz',
      })
    ).toBeTruthy();
  });

  it('renders a start error as an accessible alert', async () => {
    jest.mocked(startQuizAttempt).mockRejectedValue(new Error('Start failed'));
    render(<QuizScreen integrityTier="device" locale="en-US" />);

    fireEvent.press(
      await screen.findByRole('button', {
        name: 'Start free exam Daily Prize Quiz',
      })
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('Start failed');
    expect(
      screen.getByRole('button', {
        name: 'Start free exam Daily Prize Quiz',
      })
    ).toBeTruthy();
    expect(startQuizAttempt).toHaveBeenCalledWith({
      deviceFingerprint: 'a'.repeat(64),
      eventId: 'event-1',
      expectedUserId: 'quiz-shopper',
      integrityTier: 'device',
    });
  });

  it('renders a submit error as an accessible alert', async () => {
    jest.mocked(submitQuizAnswer).mockRejectedValue(new Error('Submit failed'));
    render(<QuizScreen integrityTier="strong" locale="en-US" />);

    fireEvent.press(
      await screen.findByRole('button', {
        name: 'Start free exam Daily Prize Quiz',
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
      clientAnsweredAt: expect.any(String),
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
        name: 'Start free exam Daily Prize Quiz',
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
        deviceFingerprint: 'a'.repeat(64),
        eventId: 'event-1',
        expectedUserId: 'quiz-shopper',
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
        name: 'Start free exam Daily Prize Quiz',
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
