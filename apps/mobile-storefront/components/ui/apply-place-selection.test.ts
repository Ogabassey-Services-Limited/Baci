import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { PlaceDetails } from './AddressAutocomplete.types';
import { applyPlaceSelection } from './apply-place-selection';

const mockGenerateSessionToken = jest.fn(() => 'session-token-1');

jest.mock('./AddressAutocomplete.api', () => ({
  generateSessionToken: () => mockGenerateSessionToken(),
}));

const place: PlaceDetails = {
  streetNumber: '1',
  route: 'Test Way',
  city: 'Ikeja',
  state: 'Lagos',
  zip: '',
  country: 'Nigeria',
  formattedAddress: '1 Test Way, Ikeja',
};

function createParams(overrides: { mounted?: boolean } = {}) {
  return {
    details: place,
    isMountedRef: { current: overrides.mounted ?? true },
    onSelect: jest.fn<(value: PlaceDetails) => void>(),
    setIsLoading: jest.fn<(value: boolean) => void>(),
    setPredictions: jest.fn(),
    setSessionToken: jest.fn<(value: string) => void>(),
  };
}

describe('applyPlaceSelection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('invokes onSelect, refreshes the session token, and clears loading when mounted', () => {
    // Arrange
    const params = createParams({ mounted: true });

    // Act
    applyPlaceSelection(params);

    // Assert
    expect(params.onSelect).toHaveBeenCalledWith(place);
    expect(params.setSessionToken).toHaveBeenCalledWith('session-token-1');
    expect(params.setIsLoading).toHaveBeenCalledWith(false);
    expect(params.setPredictions).toHaveBeenCalledWith([]);
  });

  it('does not invoke onSelect or touch state when the screen has unmounted', () => {
    // Arrange
    const params = createParams({ mounted: false });

    // Act
    applyPlaceSelection(params);

    // Assert
    expect(params.onSelect).not.toHaveBeenCalled();
    expect(params.setSessionToken).not.toHaveBeenCalled();
    expect(params.setIsLoading).not.toHaveBeenCalled();
    expect(params.setPredictions).not.toHaveBeenCalled();
  });

  it('skips onSelect when no place details were resolved', () => {
    // Arrange
    const params = { ...createParams({ mounted: true }), details: null };

    // Act
    applyPlaceSelection(params);

    // Assert
    expect(params.onSelect).not.toHaveBeenCalled();
    expect(params.setSessionToken).toHaveBeenCalledWith('session-token-1');
    expect(params.setIsLoading).toHaveBeenCalledWith(false);
  });
});
