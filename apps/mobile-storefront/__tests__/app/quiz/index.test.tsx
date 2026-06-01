import { jest } from '@jest/globals';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import QuizRoute from '@/app/quiz';
import {
  fetchQuizEvents,
  type QuizEvent,
  startQuizAttempt,
  submitQuizAnswer,
} from '@/services/quiz';
import { useQuizStore } from '@/stores/quiz-store';

const mockEvents: QuizEvent[] = [
  {
    id: 'event-1',
    title: 'Daily Prize Quiz',
    prizeName: 'N50,000 store credit',
    startsAt: '2026-05-20T10:00:00.000Z',
    endsAt: '2026-05-20T10:10:00.000Z',
    status: 'open',
    questionCount: 3,
  },
];

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
}));

jest.mock('@/services/quiz', () => ({
  fetchQuizEvents: jest.fn(async () => mockEvents),
  startQuizAttempt: jest.fn(async () => ({
    attemptId: 'attempt-1',
    eventId: 'event-1',
    examPassPointsSpent: 1,
    remainingLoyaltyPoints: 4,
    question: {
      id: 'question-1',
      prompt: 'What is 2 + 2?',
      options: [
        { id: 'a', label: '3' },
        { id: 'b', label: '4' },
      ],
      timeLimitSeconds: 30,
      index: 1,
      total: 3,
    },
  })),
  submitQuizAnswer: jest.fn(async () => ({
    attemptId: 'attempt-1',
    status: 'completed',
    correctAnswers: 1,
    totalQuestions: 3,
    prizeEligible: true,
  })),
}));

describe('/quiz screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useQuizStore.getState().reset();
    jest.mocked(fetchQuizEvents).mockResolvedValue(mockEvents);
    jest.mocked(startQuizAttempt).mockResolvedValue({
      attemptId: 'attempt-1',
      eventId: 'event-1',
      examPassPointsSpent: 1,
      remainingLoyaltyPoints: 4,
      question: {
        id: 'question-1',
        prompt: 'What is 2 + 2?',
        options: [
          { id: 'a', label: '3' },
          { id: 'b', label: '4' },
        ],
        timeLimitSeconds: 30,
        index: 1,
        total: 3,
      },
    });
    jest.mocked(submitQuizAnswer).mockResolvedValue({
      attemptId: 'attempt-1',
      status: 'completed',
      correctAnswers: 1,
      totalQuestions: 3,
      prizeEligible: true,
    });
  });

  it('renders an accessible event list and start CTA', async () => {
    render(<QuizRoute />);

    expect(
      await screen.findByRole('header', { name: 'Prize Exam' })
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('button', {
        name: 'Use 1 point to start Daily Prize Quiz',
      })
    ).toBeOnTheScreen();
    expect(
      screen.getByLabelText(
        'Quiz event Daily Prize Quiz, prize N50,000 store credit'
      )
    ).toBeOnTheScreen();
  });

  it('starts the selected event and renders accessible answer controls', async () => {
    render(<QuizRoute />);

    fireEvent.press(
      await screen.findByRole('button', {
        name: 'Use 1 point to start Daily Prize Quiz',
      })
    );

    expect(await screen.findByLabelText('Question 1 of 3')).toHaveProp(
      'accessibilityRole',
      'progressbar'
    );
    expect(screen.getByRole('button', { name: 'Answer 4' })).toBeOnTheScreen();

    fireEvent.press(screen.getByRole('button', { name: 'Answer 4' }));
    fireEvent.press(screen.getByRole('button', { name: 'Submit answer' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Quiz result: 1 of 3 correct')).toHaveProp(
        'accessibilityRole',
        'alert'
      );
    });
  });

  it('renders an accessible empty state when there are no quiz events', async () => {
    jest.mocked(fetchQuizEvents).mockResolvedValueOnce([]);

    render(<QuizRoute />);

    expect(
      await screen.findByText('No quiz events available.')
    ).toBeOnTheScreen();
  });

  it('renders an accessible error when loading events fails', async () => {
    jest
      .mocked(fetchQuizEvents)
      .mockRejectedValueOnce(new Error('Events unavailable'));

    render(<QuizRoute />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Events unavailable'
    );
  });

  it('renders an accessible error when starting an event fails', async () => {
    jest
      .mocked(startQuizAttempt)
      .mockRejectedValueOnce(new Error('Start unavailable'));

    render(<QuizRoute />);

    fireEvent.press(
      await screen.findByRole('button', {
        name: 'Use 1 point to start Daily Prize Quiz',
      })
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Start unavailable'
    );
  });

  it('renders an accessible error when submitting an answer fails', async () => {
    jest
      .mocked(submitQuizAnswer)
      .mockRejectedValueOnce(new Error('Submit unavailable'));

    render(<QuizRoute />);

    fireEvent.press(
      await screen.findByRole('button', {
        name: 'Use 1 point to start Daily Prize Quiz',
      })
    );
    fireEvent.press(await screen.findByRole('button', { name: 'Answer 4' }));
    fireEvent.press(screen.getByRole('button', { name: 'Submit answer' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Submit unavailable'
    );
  });
});
