import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Dimensions, Keyboard, View } from 'react-native';
import { AddressAutocomplete } from './AddressAutocomplete';

jest.mock('expo-constants', () => ({
  default: { expoConfig: { extra: { apiUrl: 'http://localhost:3000' } } },
}));
jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn().mockReturnValue('test-session-token'),
}));

const TEST_PREDICTION = {
  placeId: 'place-1',
  mainText: '123 Main Street',
  secondaryText: 'Lagos, Nigeria',
  description: '123 Main Street, Lagos, Nigeria',
};

function mockFetchSuccess() {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => ({ predictions: [TEST_PREDICTION] }),
    text: async () => '',
  });
}

async function typeAndWaitForPredictions(text = 'Lagos') {
  const input = screen.getByRole('combobox');
  fireEvent.changeText(input, text);
  await act(async () => {
    jest.runAllTimers();
    await Promise.resolve();
    await Promise.resolve();
  });
  return input;
}

describe('AddressAutocomplete', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe('blur-delay close', () => {
    it('keeps the dropdown open within the 150ms blur delay', async () => {
      mockFetchSuccess();
      render(<AddressAutocomplete />);

      const input = await typeAndWaitForPredictions();
      expect(screen.queryByText(TEST_PREDICTION.mainText)).toBeTruthy();

      fireEvent(input, 'blur');
      act(() => { jest.advanceTimersByTime(100); });

      expect(screen.queryByText(TEST_PREDICTION.mainText)).toBeTruthy();
    });

    it('closes the dropdown after the 150ms blur delay elapses', async () => {
      mockFetchSuccess();
      render(<AddressAutocomplete />);

      const input = await typeAndWaitForPredictions();
      expect(screen.queryByText(TEST_PREDICTION.mainText)).toBeTruthy();

      fireEvent(input, 'blur');
      act(() => { jest.advanceTimersByTime(160); });

      expect(screen.queryByText(TEST_PREDICTION.mainText)).toBeNull();
    });

    it('cancels the blur-close timer when the input is refocused', async () => {
      mockFetchSuccess();
      render(<AddressAutocomplete />);

      const input = await typeAndWaitForPredictions();
      expect(screen.queryByText(TEST_PREDICTION.mainText)).toBeTruthy();

      // Blur midway, then refocus before the delay expires
      fireEvent(input, 'blur');
      act(() => { jest.advanceTimersByTime(100); });
      fireEvent(input, 'focus');

      // Advance well past the original 150ms — dropdown should stay open
      act(() => { jest.advanceTimersByTime(200); });
      expect(screen.queryByText(TEST_PREDICTION.mainText)).toBeTruthy();
    });
  });

  describe('parent-scroll adjustment', () => {
    it('calls scrollRef.scrollTo when the dropdown would be clipped by the keyboard', async () => {
      mockFetchSuccess();

      const scrollRef = { current: { scrollTo: jest.fn() } };
      const scrollOffsetRef = { current: 0 };

      // Screen height 800, keyboard height 300 → keyboardTop = 500
      jest.spyOn(Dimensions, 'get').mockReturnValue({
        width: 375,
        height: 800,
        scale: 2,
        fontScale: 1,
      });
      jest.spyOn(Keyboard, 'metrics').mockReturnValue({
        height: 300,
        screenX: 0,
        screenY: 500,
        width: 375,
      });
      // screenY=400, inputHeight=52 → dropdownBottom = 400+52+280+16 = 748 > 500
      type MeasureFn = (cb: (x: number, y: number, w: number, h: number) => void) => void;
      const measureSpy = jest
        .spyOn(View.prototype as { measureInWindow: MeasureFn }, 'measureInWindow')
        .mockImplementation((cb) => cb(0, 400, 375, 52));

      render(
        <AddressAutocomplete
          scrollRef={scrollRef as unknown as React.RefObject<import('react-native').ScrollView | null>}
          scrollOffsetRef={scrollOffsetRef as React.RefObject<number>}
        />
      );

      await typeAndWaitForPredictions();

      expect(scrollRef.current.scrollTo).toHaveBeenCalledWith(
        expect.objectContaining({ y: expect.any(Number), animated: true })
      );
      expect(scrollRef.current.scrollTo.mock.calls[0][0].y).toBeGreaterThan(0);

      measureSpy.mockRestore();
    });

    it('does not call scrollRef.scrollTo when there is no keyboard overlap', async () => {
      mockFetchSuccess();

      const scrollRef = { current: { scrollTo: jest.fn() } };
      const scrollOffsetRef = { current: 0 };

      jest.spyOn(Dimensions, 'get').mockReturnValue({
        width: 375,
        height: 800,
        scale: 2,
        fontScale: 1,
      });
      jest.spyOn(Keyboard, 'metrics').mockReturnValue(undefined);

      // screenY=50 → dropdownBottom = 50+52+280+16 = 398 which is ≤ 800 (no keyboard)
      type MeasureFn = (cb: (x: number, y: number, w: number, h: number) => void) => void;
      const measureSpy = jest
        .spyOn(View.prototype as { measureInWindow: MeasureFn }, 'measureInWindow')
        .mockImplementation((cb) => cb(0, 50, 375, 52));

      render(
        <AddressAutocomplete
          scrollRef={scrollRef as unknown as React.RefObject<import('react-native').ScrollView | null>}
          scrollOffsetRef={scrollOffsetRef as React.RefObject<number>}
        />
      );

      await typeAndWaitForPredictions();

      expect(scrollRef.current.scrollTo).not.toHaveBeenCalled();

      measureSpy.mockRestore();
    });
  });
});
