import { Alert } from 'react-native';
import { presentOrderCancellationPrompt } from './order-cancellation-prompt';

describe('presentOrderCancellationPrompt', () => {
  afterEach(() => {
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
