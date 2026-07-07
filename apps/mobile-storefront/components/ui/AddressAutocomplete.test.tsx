import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { ScrollView } from 'react-native';
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
const fetchMock = jest.fn<typeof fetch>();

function mockFetchSuccess() {
  fetchMock.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ predictions: [TEST_PREDICTION] }),
    text: async () => '',
  } as Response);
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
    fetchMock.mockReset();
    global.fetch = fetchMock;
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
      act(() => {
        jest.advanceTimersByTime(100);
      });

      expect(screen.queryByText(TEST_PREDICTION.mainText)).toBeTruthy();
    });

    it('closes the dropdown after the 150ms blur delay elapses', async () => {
      mockFetchSuccess();
      render(<AddressAutocomplete />);

      const input = await typeAndWaitForPredictions();
      expect(screen.queryByText(TEST_PREDICTION.mainText)).toBeTruthy();

      fireEvent(input, 'blur');
      act(() => {
        jest.advanceTimersByTime(160);
      });

      expect(screen.queryByText(TEST_PREDICTION.mainText)).toBeNull();
    });

    it('stays open when the blur is caused by scrolling the dropdown', async () => {
      mockFetchSuccess();
      render(<AddressAutocomplete />);

      const input = await typeAndWaitForPredictions();
      expect(screen.queryByText(TEST_PREDICTION.mainText)).toBeTruthy();

      // Dragging the dropdown dismisses the keyboard, which blurs the input.
      // The touch is recent, so the close must be suppressed.
      const scrollView = screen.UNSAFE_getByType(ScrollView);
      fireEvent(scrollView, 'touchStart');
      fireEvent(input, 'blur');
      act(() => {
        jest.advanceTimersByTime(200);
      });

      expect(screen.queryByText(TEST_PREDICTION.mainText)).toBeTruthy();
    });

    it('suppresses a blur arriving right after the dropdown touch was cancelled', async () => {
      mockFetchSuccess();
      render(<AddressAutocomplete />);

      const input = await typeAndWaitForPredictions();
      const scrollView = screen.UNSAFE_getByType(ScrollView);
      // Android gesture-steal: the parent ScrollView takes over the drag,
      // cancelling the dropdown touch BEFORE the keyboard-dismiss blur lands.
      // Recency (not a live flag) must keep the dropdown open.
      fireEvent(scrollView, 'touchStart');
      fireEvent(scrollView, 'touchCancel');
      fireEvent(input, 'blur');
      act(() => {
        jest.advanceTimersByTime(200);
      });

      expect(screen.queryByText(TEST_PREDICTION.mainText)).toBeTruthy();
    });

    it('closes on a genuine blur after the interaction grace window has passed', async () => {
      mockFetchSuccess();
      render(<AddressAutocomplete />);

      const input = await typeAndWaitForPredictions();
      const scrollView = screen.UNSAFE_getByType(ScrollView);
      fireEvent(scrollView, 'touchStart');
      fireEvent(scrollView, 'touchEnd');
      // Let the 750ms grace window expire — the next blur is genuine.
      act(() => {
        jest.advanceTimersByTime(800);
      });
      fireEvent(input, 'blur');
      act(() => {
        jest.advanceTimersByTime(200);
      });

      expect(screen.queryByText(TEST_PREDICTION.mainText)).toBeNull();
    });

    it('closes on a blur long after a momentum fling ended', async () => {
      mockFetchSuccess();
      render(<AddressAutocomplete />);

      const input = await typeAndWaitForPredictions();
      const scrollView = screen.UNSAFE_getByType(ScrollView);
      fireEvent(scrollView, 'touchStart');
      fireEvent(scrollView, 'momentumScrollEnd');
      act(() => {
        jest.advanceTimersByTime(800);
      });
      fireEvent(input, 'blur');
      act(() => {
        jest.advanceTimersByTime(200);
      });

      expect(screen.queryByText(TEST_PREDICTION.mainText)).toBeNull();
    });

    it('closes the dropdown when the outside-tap scrim is pressed', async () => {
      mockFetchSuccess();
      render(<AddressAutocomplete />);

      await typeAndWaitForPredictions();
      expect(screen.queryByText(TEST_PREDICTION.mainText)).toBeTruthy();

      // Sticky state: dropdown open after a scroll blur; tapping outside it
      // (the scrim) must dismiss it since the input can no longer blur.
      fireEvent.press(screen.getByLabelText('Close address suggestions'));

      expect(screen.queryByText(TEST_PREDICTION.mainText)).toBeNull();
    });

    it('cancels the blur-close timer when the input is refocused', async () => {
      mockFetchSuccess();
      render(<AddressAutocomplete />);

      const input = await typeAndWaitForPredictions();
      expect(screen.queryByText(TEST_PREDICTION.mainText)).toBeTruthy();

      // Blur midway, then refocus before the delay expires
      fireEvent(input, 'blur');
      act(() => {
        jest.advanceTimersByTime(100);
      });
      fireEvent(input, 'focus');

      // Advance well past the original 150ms — dropdown should stay open
      act(() => {
        jest.advanceTimersByTime(200);
      });
      expect(screen.queryByText(TEST_PREDICTION.mainText)).toBeTruthy();
    });
  });

});
