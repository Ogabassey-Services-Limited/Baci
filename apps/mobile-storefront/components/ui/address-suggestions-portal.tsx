import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  Dimensions,
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type Colors from '@/constants/Colors';
import { addressAutocompleteStyles as styles } from './AddressAutocomplete.styles';
import type { PlacePrediction } from './AddressAutocomplete.types';
import { AddressPredictionRow } from './AddressPredictionRow';

type ColorsScheme = (typeof Colors)['light'];

const DROPDOWN_MAX_HEIGHT = 280;
const DROPDOWN_ANCHOR_GAP = 4;
const DROPDOWN_KEYBOARD_PADDING = 8;

/** Window-coordinate rect of the input the dropdown anchors under. */
export interface AddressAnchorRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface AddressSuggestionsState {
  anchor: AddressAnchorRect;
  colors: ColorsScheme;
  isDark: boolean;
  onSelect: (prediction: PlacePrediction) => void;
  predictions: PlacePrediction[];
}

interface AddressSuggestionsContextValue {
  show: (state: AddressSuggestionsState) => void;
  hide: () => void;
}

// External store so the dropdown's frequent anchor updates (it tracks the
// field while the form scrolls) rerender ONLY the host layer, never the
// provider's children (the whole checkout screen).
interface SuggestionsStore {
  getSnapshot: () => AddressSuggestionsState | null;
  set: (state: AddressSuggestionsState | null) => void;
  subscribe: (listener: () => void) => () => void;
}

function createSuggestionsStore(): SuggestionsStore {
  let state: AddressSuggestionsState | null = null;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => state,
    set: (next) => {
      state = next;
      for (const listener of listeners) {
        listener();
      }
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

const AddressSuggestionsContext =
  createContext<AddressSuggestionsContextValue | null>(null);

export function useAddressSuggestionsPortal(): AddressSuggestionsContextValue {
  const context = useContext(AddressSuggestionsContext);
  if (!context) {
    throw new Error(
      'useAddressSuggestionsPortal requires an AddressSuggestionsProvider above the field (see CheckoutScreenView).'
    );
  }
  return context;
}

/**
 * Root-level portal for address suggestions. The dropdown LOOKS attached to
 * the input but renders in this screen-root layer — outside every ScrollView —
 * so the form's scroll gestures, keyboard-dismiss-on-drag, Android
 * parent-bounds hit-testing, and sibling z-order can never break it. Same
 * architecture as react-native-autocomplete-dropdown v5.
 */
export function AddressSuggestionsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const storeRef = useRef<SuggestionsStore | null>(null);
  if (!storeRef.current) {
    storeRef.current = createSuggestionsStore();
  }
  const store = storeRef.current;

  const show = useCallback(
    (next: AddressSuggestionsState) => store.set(next),
    [store]
  );
  const hide = useCallback(() => store.set(null), [store]);
  const value = useMemo(() => ({ show, hide }), [show, hide]);

  return (
    <AddressSuggestionsContext.Provider value={value}>
      {children}
      <AddressSuggestionsHost store={store} />
    </AddressSuggestionsContext.Provider>
  );
}

function AddressSuggestionsHost({ store }: { store: SuggestionsStore }) {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot);

  // Track the keyboard so the list never extends underneath it.
  const [keyboardTop, setKeyboardTop] = useState<number | null>(null);
  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', (event) => {
      setKeyboardTop(event.endCoordinates.screenY);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardTop(null);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  if (!state || state.predictions.length === 0) {
    return null;
  }

  const { anchor, colors, isDark, onSelect, predictions } = state;
  const top = anchor.y + anchor.height + DROPDOWN_ANCHOR_GAP;
  const bottomLimit =
    (keyboardTop ?? Dimensions.get('window').height) -
    DROPDOWN_KEYBOARD_PADDING;
  const maxHeight = Math.max(
    0,
    Math.min(DROPDOWN_MAX_HEIGHT, bottomLimit - top)
  );
  if (maxHeight === 0) {
    return null;
  }

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <View
        style={[
          styles.floatingDropdown,
          {
            backgroundColor: colors.card,
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : colors.border,
            left: anchor.x,
            maxHeight,
            top,
            width: anchor.width,
          },
        ]}
        accessibilityLabel="Address suggestions"
        accessibilityRole="list"
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {predictions.map((item) => (
            <AddressPredictionRow
              colors={colors}
              isDark={isDark}
              key={item.placeId}
              onSelect={onSelect}
              prediction={item}
            />
          ))}
          <View
            style={[
              styles.footer,
              {
                backgroundColor: isDark
                  ? 'rgba(255,255,255,0.04)'
                  : colors.muted,
              },
            ]}
          >
            <Text style={[styles.footerText, { color: colors.textSecondary }]}>
              Powered by{' '}
            </Text>
            <Text style={[styles.footerText, { color: '#4285F4' }]}>G</Text>
            <Text style={[styles.footerText, { color: '#EA4335' }]}>o</Text>
            <Text style={[styles.footerText, { color: '#FBBC05' }]}>o</Text>
            <Text style={[styles.footerText, { color: '#4285F4' }]}>g</Text>
            <Text style={[styles.footerText, { color: '#34A853' }]}>l</Text>
            <Text style={[styles.footerText, { color: '#EA4335' }]}>e</Text>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}
