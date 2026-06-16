import { Alert, Platform } from 'react-native';
import { presentOrderCancellationPrompt } from './order-cancellation-prompt';

const originalPlatformOS = Platform.OS;

describe('presentOrderCancellationPrompt', () => {
  beforeEach(() => {
    Platform.OS = 'ios';
  });

  afterEach(() => {
    Platform.OS = originalPlatformOS;
    jest.restoreAllMocks();
  });

  it('offers each cancellation reason plus a no-reason confirm and a keep option', () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    presentOrderCancellationPrompt({
      onConfirm: jest.fn(),
      reasons: ['Changed my mind', 'Other'],
    });

    const [, , buttons] = alertSpy.mock.calls[0];
    const labels = buttons?.map((button) => button.text) ?? [];

    expect(labels).toContain('Changed my mind');
    expect(labels).toContain('Other');
    expect(labels).toContain('Keep Order');
    expect(buttons?.some((button) => button.style === 'destructive')).toBe(
      true
    );
    expect(buttons?.some((button) => button.style === 'cancel')).toBe(true);
  });

  it('keeps Android prompts within the native three-button Alert limit', () => {
    Platform.OS = 'android';
    const onConfirm = jest.fn();
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    presentOrderCancellationPrompt({
      onConfirm,
      reasons: [
        'Changed my mind',
        'Ordered by mistake',
        'Found a better price',
        'Other',
      ],
    });

    const firstPromptButtons = alertSpy.mock.calls[0][2] ?? [];
    expect(firstPromptButtons).toHaveLength(3);
    expect(firstPromptButtons.map((button) => button.text)).toEqual([
      'Choose a reason',
      'Cancel without a reason',
      'Keep Order',
    ]);

    firstPromptButtons[0]?.onPress?.();

    const firstReasonPageButtons = alertSpy.mock.calls[1][2] ?? [];
    expect(firstReasonPageButtons).toHaveLength(3);
    expect(firstReasonPageButtons.map((button) => button.text)).toEqual([
      'Changed my mind',
      'Ordered by mistake',
      'More reasons',
    ]);

    firstReasonPageButtons[2]?.onPress?.();

    const secondReasonPageButtons = alertSpy.mock.calls[2][2] ?? [];
    expect(secondReasonPageButtons).toHaveLength(3);
    expect(secondReasonPageButtons.map((button) => button.text)).toEqual([
      'Found a better price',
      'Other',
      'Back',
    ]);

    secondReasonPageButtons[0]?.onPress?.();
    expect(onConfirm).toHaveBeenCalledWith('Found a better price');
  });

  it('confirms with the chosen reason when a reason button is pressed', () => {
    const onConfirm = jest.fn();
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find((button) => button.text === 'Changed my mind')?.onPress?.();
    });

    presentOrderCancellationPrompt({
      onConfirm,
      reasons: ['Changed my mind', 'Other'],
    });

    expect(onConfirm).toHaveBeenCalledWith('Changed my mind');
  });

  it('confirms without a reason when the destructive option is pressed', () => {
    const onConfirm = jest.fn();
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find((button) => button.style === 'destructive')?.onPress?.();
    });

    presentOrderCancellationPrompt({ onConfirm, reasons: ['Changed my mind'] });

    expect(onConfirm).toHaveBeenCalledWith(undefined);
  });

  it('does not confirm when the keep option is pressed', () => {
    const onConfirm = jest.fn();
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find((button) => button.style === 'cancel')?.onPress?.();
    });

    presentOrderCancellationPrompt({ onConfirm, reasons: ['Changed my mind'] });

    expect(onConfirm).not.toHaveBeenCalled();
  });
});
