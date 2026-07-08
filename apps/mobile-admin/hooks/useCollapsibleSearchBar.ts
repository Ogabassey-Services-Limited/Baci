import { useRef, useState } from 'react';
import {
  Animated,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

const SCROLL_DELTA_THRESHOLD = 10;
const COLLAPSE_MIN_OFFSET = 50;
const TOGGLE_DURATION_MS = 200;

/**
 * Hides the search bar while scrolling down and restores it on scroll-up.
 * Returns a native-driver Animated.Value for the bar plus the list onScroll
 * handler. useState initializer keeps a stable Animated.Value without reading
 * a ref during render (React Compiler safe).
 */
export function useCollapsibleSearchBar() {
  const [searchBarAnim] = useState(() => new Animated.Value(1));
  const [isSearchActionsVisible, setIsSearchActionsVisible] = useState(true);
  const lastScrollY = useRef(0);
  const isSearchVisible = useRef(true);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const currentScrollY = event.nativeEvent.contentOffset.y;
    const diff = currentScrollY - lastScrollY.current;

    if (Math.abs(diff) <= SCROLL_DELTA_THRESHOLD) {
      return;
    }

    if (
      diff > 0 &&
      isSearchVisible.current &&
      currentScrollY > COLLAPSE_MIN_OFFSET
    ) {
      isSearchVisible.current = false;
      setIsSearchActionsVisible(false);
      Animated.timing(searchBarAnim, {
        toValue: 0,
        duration: TOGGLE_DURATION_MS,
        useNativeDriver: true,
      }).start();
      lastScrollY.current = currentScrollY;
    } else if (diff < 0 && !isSearchVisible.current) {
      isSearchVisible.current = true;
      setIsSearchActionsVisible(true);
      Animated.timing(searchBarAnim, {
        toValue: 1,
        duration: TOGGLE_DURATION_MS,
        useNativeDriver: true,
      }).start();
      lastScrollY.current = currentScrollY;
    } else if (!isSearchVisible.current) {
      lastScrollY.current = currentScrollY;
    }
  };

  return { handleScroll, isSearchActionsVisible, searchBarAnim };
}
