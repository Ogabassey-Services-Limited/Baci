import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AddressAutocomplete } from './AddressAutocomplete';
import { clearPredictionCache } from './AddressAutocomplete.api';

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

const TEST_DETAILS_RESPONSE = {
  details: {
    streetNumber: '123',
    route: 'Main Street',
    city: 'Lagos',
    state: 'Lagos',
    postalCode: '100001',
    country: 'Nigeria',
    formattedAddress: '123 Main Street, Lagos, Nigeria',
  },
};

function mockPredictionsSuccess() {
  fetchMock.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ predictions: [TEST_PREDICTION] }),
    text: async () => '',
  } as Response);
}

function mockDetailsSuccess() {
  fetchMock.mockResolvedValueOnce({
    ok: true,
    json: async () => TEST_DETAILS_RESPONSE,
    text: async () => '',
  });
}

function openSearchSheet() {
  fireEvent.press(screen.getByRole('button', { name: 'Street address' }));
  return screen.getByPlaceholderText('Start typing your address...');
}

async function typeAndWaitForPredictions(text = 'Lagos') {
  const input = openSearchSheet();
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
    // The predictions API keeps a module-level cache; clear it so each test's
    // queued fetch mocks are consumed by the calls they were queued for.
    clearPredictionCache();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it('renders the trigger row with the placeholder when empty', () => {
    render(<AddressAutocomplete />);

    expect(screen.getByText('Start typing your address...')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Street address' })).toBeTruthy();
  });

  it('shows the current value on the trigger row', () => {
    render(<AddressAutocomplete value="7 Marina Road" />);

    expect(screen.getByText('7 Marina Road')).toBeTruthy();
  });

  it('opens the search sheet when the trigger is pressed', () => {
    render(<AddressAutocomplete />);

    const input = openSearchSheet();

    expect(input).toBeTruthy();
  });

  it('shows predictions in the sheet after typing', async () => {
    mockPredictionsSuccess();
    render(<AddressAutocomplete />);

    await typeAndWaitForPredictions();

    expect(screen.getByText(TEST_PREDICTION.mainText)).toBeTruthy();
    expect(screen.getByText(TEST_PREDICTION.secondaryText)).toBeTruthy();
  });

  it('commits a prediction on a single tap: writes text, fetches details, closes the sheet', async () => {
    mockPredictionsSuccess();
    mockDetailsSuccess();
    const onChangeText = jest.fn();
    const onSelect = jest.fn();
    render(
      <AddressAutocomplete onChangeText={onChangeText} onSelect={onSelect} />
    );

    await typeAndWaitForPredictions();
    fireEvent.press(
      screen.getByRole('button', {
        name: `${TEST_PREDICTION.mainText}, ${TEST_PREDICTION.secondaryText}`,
      })
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(onChangeText).toHaveBeenCalledWith(TEST_PREDICTION.mainText);
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ city: 'Lagos', route: 'Main Street' })
    );
    // Sheet is closed — its search input is gone.
    expect(
      screen.queryByPlaceholderText('Start typing your address...')
    ).toBeNull();
  });

  it('commits free text via the "Use typed address" row without calling onSelect', async () => {
    const onChangeText = jest.fn();
    const onSelect = jest.fn();
    render(
      <AddressAutocomplete onChangeText={onChangeText} onSelect={onSelect} />
    );

    const input = openSearchSheet();
    fireEvent.changeText(input, 'Off-grid address 5');
    fireEvent.press(
      screen.getByRole('button', { name: 'Use Off-grid address 5 as address' })
    );

    expect(onChangeText).toHaveBeenCalledWith('Off-grid address 5');
    expect(onSelect).not.toHaveBeenCalled();
    expect(
      screen.queryByPlaceholderText('Start typing your address...')
    ).toBeNull();
  });

  it('keeps the existing value when the sheet is dismissed without choosing', () => {
    const onChangeText = jest.fn();
    render(
      <AddressAutocomplete value="7 Marina Road" onChangeText={onChangeText} />
    );

    openSearchSheet();
    fireEvent.press(
      screen.getByRole('button', { name: 'Close address search' })
    );

    expect(onChangeText).not.toHaveBeenCalled();
    expect(screen.getByText('7 Marina Road')).toBeTruthy();
  });

  it('clears the value from the trigger row', () => {
    const onChangeText = jest.fn();
    render(
      <AddressAutocomplete value="7 Marina Road" onChangeText={onChangeText} />
    );

    fireEvent.press(screen.getByRole('button', { name: 'Clear address' }));

    expect(onChangeText).toHaveBeenCalledWith('');
  });

  it('renders the error message', () => {
    render(<AddressAutocomplete error="Address is required" />);

    expect(screen.getByText('Address is required')).toBeTruthy();
  });
});
