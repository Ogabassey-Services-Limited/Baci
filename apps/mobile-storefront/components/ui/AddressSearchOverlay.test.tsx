import { act, fireEvent, render, screen } from '@testing-library/react-native';
import Colors from '@/constants/Colors';
import { AddressSearchOverlay } from './AddressSearchOverlay';

jest.mock('expo-constants', () => ({
  default: { expoConfig: { extra: { apiUrl: 'http://localhost:3000' } } },
}));
jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn().mockReturnValue('test-session-token'),
}));

const TEST_PREDICTION = {
  placeId: 'place-9',
  mainText: '9 Allen Avenue',
  secondaryText: 'Ikeja, Nigeria',
  description: '9 Allen Avenue, Ikeja, Nigeria',
};

function baseProps(overrides: Record<string, unknown> = {}) {
  return {
    colors: Colors.light,
    country: 'ng',
    initialValue: '',
    isDark: false,
    onClose: jest.fn(),
    onSelectPrediction: jest.fn(),
    onUseTypedAddress: jest.fn(),
    sessionToken: 'test-session-token',
    visible: true,
    ...overrides,
  };
}

describe('AddressSearchOverlay', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ predictions: [TEST_PREDICTION] }),
      text: async () => '',
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it('seeds the search box from initialValue when opened', () => {
    const props = baseProps({
      initialValue: '12 Awolowo Road',
      visible: false,
    });
    const view = render(<AddressSearchOverlay {...props} />);

    view.rerender(<AddressSearchOverlay {...props} visible={true} />);

    expect(screen.getByDisplayValue('12 Awolowo Road')).toBeTruthy();
  });

  it('debounces prediction fetches until the debounce window elapses', () => {
    render(<AddressSearchOverlay {...baseProps()} />);

    fireEvent.changeText(
      screen.getByPlaceholderText('Start typing your address...'),
      'Allen'
    );

    expect(global.fetch).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(350);
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('offers the typed address as a selectable row', () => {
    const props = baseProps();
    render(<AddressSearchOverlay {...props} />);

    fireEvent.changeText(
      screen.getByPlaceholderText('Start typing your address...'),
      'Plot 4 New Layout'
    );
    fireEvent.press(
      screen.getByRole('button', { name: 'Use Plot 4 New Layout as address' })
    );

    expect(props.onUseTypedAddress).toHaveBeenCalledWith('Plot 4 New Layout');
  });

  it('reports prediction selection to the host', async () => {
    const props = baseProps();
    render(<AddressSearchOverlay {...props} />);

    fireEvent.changeText(
      screen.getByPlaceholderText('Start typing your address...'),
      'Allen'
    );
    await act(async () => {
      jest.runAllTimers();
      await Promise.resolve();
      await Promise.resolve();
    });
    fireEvent.press(
      screen.getByRole('button', {
        name: `${TEST_PREDICTION.mainText}, ${TEST_PREDICTION.secondaryText}`,
      })
    );

    expect(props.onSelectPrediction).toHaveBeenCalledWith(TEST_PREDICTION);
  });

  it('closes from the backdrop and the header button', () => {
    const props = baseProps();
    render(<AddressSearchOverlay {...props} />);

    fireEvent.press(
      screen.getByRole('button', { name: 'Dismiss address search' })
    );
    fireEvent.press(
      screen.getByRole('button', { name: 'Close address search' })
    );

    expect(props.onClose).toHaveBeenCalledTimes(2);
  });
});
