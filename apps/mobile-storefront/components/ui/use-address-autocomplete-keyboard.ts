import type { RefObject } from 'react';
import { useEffect, useRef } from 'react';
import { Dimensions, Keyboard, type ScrollView, View } from 'react-native';

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
  const keyboardHeightRef = useRef(0);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', (e) => {
      keyboardHeightRef.current = e.endCoordinates.height;
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      keyboardHeightRef.current = 0;
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
      const kbHeight =
        keyboardHeightRef.current || Keyboard.metrics()?.height || 0;
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
  }, [isOpen, predictionCount, scrollRef, scrollOffsetRef, wrapperRef]);
}
