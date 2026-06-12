import type { RefObject } from 'react';
import { generateSessionToken } from './AddressAutocomplete.api';
import type {
  PlaceDetails,
  PlacePrediction,
} from './AddressAutocomplete.types';

interface ApplyPlaceSelectionParams {
  details: PlaceDetails | null;
  isMountedRef: RefObject<boolean>;
  onSelect?: (place: PlaceDetails) => void;
  setIsLoading: (value: boolean) => void;
  setPredictions: (value: PlacePrediction[]) => void;
  setSessionToken: (value: string) => void;
}

// Module-scope helper: keeping the try/finally statement out of the component
// body lets React Compiler memoize AddressAutocomplete.
export function applyPlaceSelection({
  details,
  isMountedRef,
  onSelect,
  setIsLoading,
  setPredictions,
  setSessionToken,
}: ApplyPlaceSelectionParams) {
  try {
    // Guard the callback with the same mounted check as every other side
    // effect here: handlePredictionSelect awaits network I/O before calling
    // this, so a late onSelect could fire navigation/parent updates from a
    // dead screen.
    if (details && onSelect && isMountedRef.current) {
      onSelect(details);
    }
    if (isMountedRef.current) {
      setSessionToken(generateSessionToken());
    }
  } finally {
    if (isMountedRef.current) {
      setIsLoading(false);
      setPredictions([]);
    }
  }
}
