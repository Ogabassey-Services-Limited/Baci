import { act } from '@testing-library/react-native';
import type { QuizResult } from '@/services/quiz';
import { QuizServiceError } from '@/services/quiz-types';
import { useQuizStore } from './quiz-store';
import {
  attempt,
  createDeferred,
  events,
  result,
} from './quiz-store.test-utils';

describe('useQuizStore', () => {
  beforeEach(() => {
    useQuizStore.getState().reset();
  });

  it('moves from event list to started question to result', async () => {
    await act(async () => {
      await useQuizStore.getState().loadEvents(async () => events);
    });

    expect(useQuizStore.getState()).toMatchObject({
      status: 'ready',
      events,
      selectedEventId: null,
    });

    await act(async () => {
      await useQuizStore
        .getState()
        .startEvent('event-1', 'strong', async () => attempt);
    });

    expect(useQuizStore.getState()).toMatchObject({
      status: 'question',
      attemptIntegrityTier: 'strong',
      selectedEventId: 'event-1',
      attempt,
      selectedOptionId: null,
    });

    act(() => {
      useQuizStore.getState().selectAnswer('b');
    });

    expect(useQuizStore.getState().selectedOptionId).toBe('b');

    await act(async () => {
      await useQuizStore.getState().submitSelectedAnswer(async () => result);
    });

    expect(useQuizStore.getState()).toMatchObject({
      status: 'result',
      result,
    });
  });

  it('returns a recoverable error when a legacy submit outlives its attempt', async () => {
    useQuizStore.setState({ selectedOptionId: 'b', status: 'question' });
    const submitter = jest.fn(async () => result);

    await act(async () => {
      await useQuizStore.getState().submitSelectedAnswer(submitter);
    });

    expect(submitter).not.toHaveBeenCalled();
    expect(useQuizStore.getState()).toMatchObject({
      error: 'No active quiz attempt. Start a quiz to continue.',
      status: 'ready',
    });
  });

  it('clears stale attempts while a new event is starting', async () => {
    const nextAttempt = {
      ...attempt,
      attemptId: 'attempt-2',
      eventId: 'event-2',
    };
    const deferred = createDeferred<typeof nextAttempt>();

    act(() => {
      useQuizStore.setState({
        status: 'result',
        attempt,
        result,
        selectedEventId: 'event-1',
      });
    });

    const startPromise = act(async () => {
      await useQuizStore
        .getState()
        .startEvent('event-2', 'strong', async () => deferred.promise);
    });

    expect(useQuizStore.getState()).toMatchObject({
      status: 'starting',
      attempt: null,
      selectedEventId: 'event-2',
      attemptIntegrityTier: 'strong',
    });

    deferred.resolve(nextAttempt);
    await startPromise;

    expect(useQuizStore.getState()).toMatchObject({
      status: 'question',
      attempt: nextAttempt,
    });
  });

  it('ignores a start while a submit is in flight so the stale result cannot overwrite it', async () => {
    // A submit is in flight (status 'submitting'). Because startEvent does not
    // bump stateGeneration, a start that clears `attempt` here would let the
    // in-flight submit's continuation write its stale result back over the new
    // attempt — so startEvent must no-op until the submit settles.
    act(() => {
      useQuizStore.setState({
        status: 'submitting',
        attempt,
        selectedEventId: 'event-1',
      });
    });

    let starterCalled = false;
    await act(async () => {
      await useQuizStore
        .getState()
        .startEvent('event-2', 'strong', async () => {
          starterCalled = true;
          return { ...attempt, attemptId: 'attempt-2', eventId: 'event-2' };
        });
    });

    expect(starterCalled).toBe(false);
    expect(useQuizStore.getState()).toMatchObject({
      status: 'submitting',
      attempt,
      selectedEventId: 'event-1',
    });
  });

  it('returns to the event list after a start attempt failure', async () => {
    await act(async () => {
      await useQuizStore.getState().loadEvents(async () => events);
    });

    await act(async () => {
      await useQuizStore
        .getState()
        .startEvent('event-1', 'strong', async () => {
          throw new Error('Exam pass unavailable');
        });
    });

    expect(useQuizStore.getState()).toMatchObject({
      status: 'ready',
      events,
      attempt: null,
      selectedEventId: 'event-1',
      error: 'Exam pass unavailable',
    });
  });

  it('keeps the attempt open when submit returns the next question', async () => {
    const nextQuestion = {
      ...attempt.question,
      id: 'question-2',
      index: 2,
      prompt: 'Pick again',
    };

    await act(async () => {
      await useQuizStore
        .getState()
        .startEvent('event-1', 'device', async () => attempt);
    });
    act(() => {
      useQuizStore.getState().selectAnswer('b');
    });

    await act(async () => {
      await useQuizStore.getState().submitSelectedAnswer(async () => ({
        ...result,
        status: 'in_progress',
        question: nextQuestion,
      }));
    });

    expect(useQuizStore.getState()).toMatchObject({
      status: 'question',
      selectedOptionId: null,
      attempt: { ...attempt, question: nextQuestion },
      result: null,
    });
  });

  it('keeps the submitted attempt snapshot while an answer is in flight', async () => {
    const nextQuestion = {
      ...attempt.question,
      id: 'question-2',
      index: 2,
      prompt: 'Pick again',
    };
    const deferred = createDeferred<QuizResult>();

    await act(async () => {
      await useQuizStore
        .getState()
        .startEvent('event-1', 'device', async () => attempt);
    });
    act(() => {
      useQuizStore.getState().selectAnswer('b');
    });

    const submitPromise = act(async () => {
      await useQuizStore
        .getState()
        .submitSelectedAnswer(async () => deferred.promise);
    });

    act(() => {
      useQuizStore.getState().selectAnswer('a');
    });
    expect(useQuizStore.getState()).toMatchObject({
      status: 'submitting',
      error: 'Answer is already being submitted.',
    });

    deferred.resolve({
      ...result,
      status: 'in_progress',
      question: nextQuestion,
    });
    await submitPromise;

    expect(useQuizStore.getState()).toMatchObject({
      status: 'question',
      selectedOptionId: null,
      attempt: { ...attempt, question: nextQuestion },
    });
  });

  it('fails closed when an in-progress submit response omits the next question', async () => {
    await act(async () => {
      await useQuizStore
        .getState()
        .startEvent('event-1', 'device', async () => attempt);
    });
    act(() => {
      useQuizStore.getState().selectAnswer('b');
    });

    await act(async () => {
      await useQuizStore.getState().submitSelectedAnswer(async () => ({
        ...result,
        status: 'in_progress',
        question: undefined,
      }));
    });

    expect(useQuizStore.getState()).toMatchObject({
      status: 'error',
      error: 'Quiz response did not include the next question.',
    });
  });

  it('surfaces async action failures and invalid selection transitions', async () => {
    await act(async () => {
      await useQuizStore
        .getState()
        .loadEvents(async () => Promise.reject(new Error('events failed')));
    });
    expect(useQuizStore.getState()).toMatchObject({
      status: 'ready',
      error: 'events failed',
    });

    act(() => {
      useQuizStore.getState().selectAnswer('a');
    });
    expect(useQuizStore.getState()).toMatchObject({
      status: 'ready',
      error: 'Cannot select answer outside question phase.',
    });
  });

  it('surfaces non-Error async failures with runtime context', async () => {
    await act(async () => {
      await useQuizStore.getState().loadEvents(async () => {
        throw { code: 'EVENTS_FAILED' };
      });
    });

    expect(useQuizStore.getState()).toMatchObject({
      status: 'ready',
      error: 'Quiz action failed (Object: {"code":"EVENTS_FAILED"})',
    });
  });

  it('surfaces null-prototype async failures without throwing from error handling', async () => {
    const nullPrototypeError = Object.assign(Object.create(null), {
      code: 'NO_PROTOTYPE',
    });

    await act(async () => {
      await useQuizStore.getState().loadEvents(async () => {
        throw nullPrototypeError;
      });
    });

    expect(useQuizStore.getState()).toMatchObject({
      status: 'ready',
      error: 'Quiz action failed (Object: {"code":"NO_PROTOTYPE"})',
    });
  });

  it('requires an answer before submitting', async () => {
    await act(async () => {
      await useQuizStore
        .getState()
        .startEvent('event-1', 'basic', async () => attempt);
    });

    await act(async () => {
      await useQuizStore.getState().submitSelectedAnswer(async () => result);
    });

    expect(useQuizStore.getState()).toMatchObject({
      status: 'question',
      error: 'Select an answer before submitting.',
    });
  });

  it('submits a forfeit without a selected answer and completes to a result', async () => {
    await act(async () => {
      await useQuizStore
        .getState()
        .startEvent('event-1', 'basic', async () => attempt);
    });

    const submitter = jest.fn(async () => result);
    await act(async () => {
      await useQuizStore.getState().forfeitAnswer(submitter);
    });

    expect(submitter).toHaveBeenCalledTimes(1);
    expect(useQuizStore.getState()).toMatchObject({ status: 'result', result });
  });

  it('keeps a failed timeout forfeit retryable', async () => {
    await act(async () => {
      await useQuizStore
        .getState()
        .startEvent('event-1', 'basic', async () => attempt);
    });

    const submitter = jest
      .fn(async (): Promise<QuizResult> => result)
      .mockRejectedValueOnce(new Error('Temporary network failure'))
      .mockResolvedValueOnce(result);

    await act(async () => {
      await useQuizStore
        .getState()
        .forfeitAnswer(submitter, '__timeout_no_answer__');
    });

    expect(useQuizStore.getState()).toMatchObject({
      status: 'question',
      selectedOptionId: '__timeout_no_answer__',
      error: 'Temporary network failure',
    });

    await act(async () => {
      await useQuizStore
        .getState()
        .forfeitAnswer(submitter, '__timeout_no_answer__');
    });

    expect(submitter).toHaveBeenCalledTimes(2);
    expect(useQuizStore.getState()).toMatchObject({ status: 'result', result });
  });

  it('advances to the next question when a forfeit returns in_progress', async () => {
    const nextQuestion = {
      ...attempt.question,
      id: 'question-2',
      index: 2,
      prompt: 'Next one',
    };

    await act(async () => {
      await useQuizStore
        .getState()
        .startEvent('event-1', 'basic', async () => attempt);
    });

    await act(async () => {
      await useQuizStore.getState().forfeitAnswer(async () => ({
        ...result,
        status: 'in_progress',
        question: nextQuestion,
      }));
    });

    expect(useQuizStore.getState()).toMatchObject({
      status: 'question',
      selectedOptionId: null,
      attempt: { ...attempt, question: nextQuestion },
    });
  });

  it('ignores a concurrent start while one attempt is already starting', async () => {
    const deferred = createDeferred<typeof attempt>();
    const firstStarter = jest.fn(() => deferred.promise);
    const secondStarter = jest.fn(async () => attempt);

    const startPromise = act(async () => {
      await useQuizStore
        .getState()
        .startEvent('event-1', 'strong', firstStarter);
    });

    // A double-tap fires a second start before the first resolves.
    act(() => {
      void useQuizStore
        .getState()
        .startEvent('event-1', 'strong', secondStarter);
    });

    expect(secondStarter).not.toHaveBeenCalled();
    expect(useQuizStore.getState().status).toBe('starting');

    deferred.resolve(attempt);
    await startPromise;
    expect(firstStarter).toHaveBeenCalledTimes(1);
  });

  it('drops an in-flight submit result after a reset (sign-out / account switch)', async () => {
    const deferred = createDeferred<QuizResult>();

    await act(async () => {
      await useQuizStore
        .getState()
        .startEvent('event-1', 'strong', async () => attempt);
    });
    act(() => {
      useQuizStore.getState().selectAnswer('b');
    });

    const submitPromise = act(async () => {
      await useQuizStore
        .getState()
        .submitSelectedAnswer(async () => deferred.promise);
    });

    // The previous session signs out / switches accounts mid-flight.
    act(() => {
      useQuizStore.getState().reset();
    });

    // The stale response (in the real flow a recovered win carrying a
    // prizeClaim) resolves after the reset — it must NOT be written back into
    // the now-empty store for the next session to see or claim.
    deferred.resolve(result);
    await submitPromise;

    expect(useQuizStore.getState()).toMatchObject({
      status: 'idle',
      attempt: null,
      result: null,
    });
  });

  it('drops an in-flight start attempt after a reset (sign-out / account switch)', async () => {
    const deferred = createDeferred<typeof attempt>();

    const startPromise = act(async () => {
      await useQuizStore
        .getState()
        .startEvent('event-1', 'strong', async () => deferred.promise);
    });

    // Store is mid-start (awaiting the attempt) for the prior session.
    expect(useQuizStore.getState()).toMatchObject({ status: 'starting' });

    // The previous session signs out / switches accounts mid-flight.
    act(() => {
      useQuizStore.getState().reset();
    });

    // The stale attempt resolves after the reset — it must NOT repopulate the
    // now-empty store, or the next session would see the prior account's
    // charged attempt/question and loyalty balance.
    deferred.resolve(attempt);
    await startPromise;

    expect(useQuizStore.getState()).toMatchObject({
      status: 'idle',
      attempt: null,
      selectedEventId: null,
      error: null,
    });
  });

  it('renders friendly copy for a known quiz service error code', async () => {
    await act(async () => {
      await useQuizStore.getState().loadEvents(async () => {
        throw new QuizServiceError(
          'attempt_limit_reached',
          'QUIZ_ATTEMPT_LIMIT_REACHED',
          409
        );
      });
    });

    expect(useQuizStore.getState().error).toBe(
      "You've reached the maximum number of attempts for this quiz."
    );
  });
});
