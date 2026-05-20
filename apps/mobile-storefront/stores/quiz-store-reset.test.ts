import { act } from '@testing-library/react-native';
import { useQuizStore } from './quiz-store';
import { attempt, events, result } from './quiz-store.test-utils';

describe('useQuizStore reset and explicit errors', () => {
  beforeEach(() => {
    useQuizStore.getState().reset();
  });

  it('sets an explicit action error state', () => {
    act(() => {
      useQuizStore.getState().setError('Unexpected quiz failure');
    });

    expect(useQuizStore.getState()).toMatchObject({
      status: 'error',
      error: 'Unexpected quiz failure',
    });
  });

  it('resets all state to initial values', () => {
    act(() => {
      useQuizStore.setState({
        status: 'result',
        events,
        selectedEventId: 'event-1',
        attempt,
        attemptIntegrityTier: 'strong',
        selectedOptionId: 'b',
        result,
        error: 'some error',
      });
    });

    act(() => {
      useQuizStore.getState().reset();
    });

    expect(useQuizStore.getState()).toMatchObject({
      status: 'idle',
      events: [],
      selectedEventId: null,
      attempt: null,
      attemptIntegrityTier: null,
      selectedOptionId: null,
      result: null,
      error: null,
    });
  });
});
