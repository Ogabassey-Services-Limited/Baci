import { act } from '@testing-library/react-native';
import { useQuizStore } from './quiz-store';
import { attempt } from './quiz-store.test-utils';

describe('useQuizStore retryable failures', () => {
  beforeEach(() => {
    useQuizStore.getState().reset();
  });

  it('keeps the current question retryable after a submit failure', async () => {
    act(() => {
      useQuizStore.setState({
        attempt,
        selectedOptionId: 'b',
        status: 'question',
      });
    });

    await act(async () => {
      await useQuizStore
        .getState()
        .submitSelectedAnswer(async () =>
          Promise.reject(new Error('submit failed'))
        );
    });

    expect(useQuizStore.getState()).toMatchObject({
      status: 'question',
      attempt,
      selectedOptionId: 'b',
      error: 'submit failed',
    });
  });
});
