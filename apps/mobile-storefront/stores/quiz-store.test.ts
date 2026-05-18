import { act } from '@testing-library/react-native';
import type { QuizResult } from '@/services/quiz';
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

  it('returns to the event list after a start attempt failure', async () => {
    await act(async () => {
      await useQuizStore.getState().loadEvents(async () => events);
    });

    await act(async () => {
      await useQuizStore.getState().startEvent('event-1', 'strong', async () => {
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
      status: 'error',
      error: 'events failed',
    });

    act(() => {
      useQuizStore.getState().selectAnswer('a');
    });
    expect(useQuizStore.getState()).toMatchObject({
      status: 'error',
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
      status: 'error',
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
      status: 'error',
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
});
