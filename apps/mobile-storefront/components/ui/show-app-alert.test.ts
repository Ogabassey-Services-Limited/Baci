import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { Alert } from 'react-native';
import { showAppAlert } from './show-app-alert';

const mockTriggerHaptic = jest.fn();

jest.mock('@/hooks/use-haptics', () => ({
  triggerHaptic: (...args: unknown[]) => mockTriggerHaptic(...args),
}));

describe('showAppAlert', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows the native alert and triggers variant haptics when configured', () => {
    showAppAlert({
      title: 'Unable to create plan',
      message: 'Try again.',
      variant: 'error',
    });

    expect(mockTriggerHaptic).toHaveBeenCalledWith('error');
    expect(Alert.alert).toHaveBeenCalledWith(
      'Unable to create plan',
      'Try again.'
    );
  });

  it('does not trigger haptics for informational alerts', () => {
    showAppAlert({
      title: 'Heads up',
      message: 'Review your savings plan.',
    });

    expect(mockTriggerHaptic).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith(
      'Heads up',
      'Review your savings plan.'
    );
  });
});
