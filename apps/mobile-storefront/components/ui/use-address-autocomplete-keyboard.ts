import type { RefObject } from 'react';
import { useEffect, useState } from 'react';
import { Dimensions, Keyboard, type ScrollView, type View } from 'react-native';

interface UseAddressAutocompleteKeyboardParams {
  isOpen: boolean;
  predictionCount: number;
  scrollOffsetRef?: RefObject<number>;
  scrollRef?: RefObject<ScrollView | null>;
  wrapperRef: RefObject<View | null>;
}

const DROPDOWN_HEIGHT = 280;
const PADDING = 16;

// Owns the keyboard-height tracking ref plus the dropdown-scroll effect so the
// ref read stays inside the hook (out of AddressAutocomplete's render body).
export function useAddressAutocompleteKeyboard({
  isOpen,
  predictionCount,
  scrollOffsetRef,
  scrollRef,
  wrapperRef,
}: UseAddressAutocompleteKeyboardParams) {
  // Driven through state (not a ref) so a `keyboardDidShow` arriving after the
  // dropdown opened re-runs the overlap calculation; a ref write would not
  // trigger the scroll effect, leaving suggestions hidden under the keyboard.
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (!isOpen || predictionCount === 0 || !scrollRef?.current) return;
    wrapperRef.current?.measureInWindow((_x, screenY, _w, inputHeight) => {
      if (screenY <= 0 || inputHeight <= 0) return;
      const screenHeight = Dimensions.get('window').height;
      const kbHeight = keyboardHeight || Keyboard.metrics()?.height || 0;
      const keyboardTop = screenHeight - kbHeight;
      const dropdownBottom = screenY + inputHeight + DROPDOWN_HEIGHT + PADDING;
      if (dropdownBottom > keyboardTop) {
        const overflow = dropdownBottom - keyboardTop;
        const currentOffset = scrollOffsetRef?.current ?? 0;
        scrollRef.current?.scrollTo({
          y: currentOffset + overflow + PADDING,
          animated: true,
        });
      }
    });
  }, [
    isOpen,
    keyboardHeight,
    predictionCount,
    scrollRef,
    scrollOffsetRef,
    wrapperRef,
  ]);
}
