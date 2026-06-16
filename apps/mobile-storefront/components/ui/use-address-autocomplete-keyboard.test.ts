import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { act, renderHook } from '@testing-library/react-native';
import { Dimensions, Keyboard, type ScrollView, type View } from 'react-native';
import { useAddressAutocompleteKeyboard } from './use-address-autocomplete-keyboard';

type KeyboardShowCb = (event: { endCoordinates: { height: number } }) => void;

function setupKeyboardListeners() {
  const callbacks: { show?: KeyboardShowCb; hide?: () => void } = {};
  const addListenerSpy = jest
    .spyOn(Keyboard, 'addListener')
    .mockImplementation((event, cb) => {
      if (event === 'keyboardDidShow') callbacks.show = cb as KeyboardShowCb;
      if (event === 'keyboardDidHide') callbacks.hide = cb as () => void;
      return { remove: jest.fn() } as unknown as ReturnType<
        typeof Keyboard.addListener
      >;
    });
  return { addListenerSpy, callbacks };
}

function createWrapperRef(screenY: number, inputHeight: number) {
  return {
    current: {
      measureInWindow: (
        cb: (x: number, y: number, w: number, h: number) => void
      ) => cb(0, screenY, 375, inputHeight),
    } as unknown as View,
  };
}

describe('useAddressAutocompleteKeyboard', () => {
  beforeEach(() => {
    jest.spyOn(Dimensions, 'get').mockReturnValue({
      width: 375,
      height: 800,
      scale: 2,
      fontScale: 1,
    });
    jest.spyOn(Keyboard, 'metrics').mockReturnValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('scrolls the parent when the dropdown overlaps the keyboard', () => {
    // Arrange
    setupKeyboardListeners();
    const scrollTo = jest.fn();
    const scrollRef = {
      current: { scrollTo } as unknown as ScrollView,
    };
    // dropdownBottom = 400 + 52 + 280 + 16 = 748; keyboardTop with kb=0 is 800.
    // Provide a keyboard height via metrics so there is overlap.
    jest.spyOn(Keyboard, 'metrics').mockReturnValue({
      height: 320,
      screenX: 0,
      screenY: 480,
      width: 375,
    });

    // Act
    renderHook(() =>
      useAddressAutocompleteKeyboard({
        isOpen: true,
        predictionCount: 3,
        scrollOffsetRef: { current: 0 },
        scrollRef,
        wrapperRef: createWrapperRef(400, 52),
      })
    );

    // Assert
    expect(scrollTo).toHaveBeenCalledWith(
      expect.objectContaining({ animated: true, y: expect.any(Number) })
    );
  });

  it('re-runs the overlap calculation when keyboardDidShow fires after open', () => {
    // Arrange: no keyboard metrics, so the first pass sees no overlap.
    const { callbacks } = setupKeyboardListeners();
    const scrollTo = jest.fn();
    const scrollRef = {
      current: { scrollTo } as unknown as ScrollView,
    };

    const { rerender } = renderHook(
      (props: { count: number }) =>
        useAddressAutocompleteKeyboard({
          isOpen: true,
          predictionCount: props.count,
          scrollOffsetRef: { current: 0 },
          scrollRef,
          wrapperRef: createWrapperRef(400, 52),
        }),
      { initialProps: { count: 3 } }
    );

    // First measurement found no keyboard, so no scroll yet.
    expect(scrollTo).not.toHaveBeenCalled();

    // Act: keyboard appears later, writing its height through state.
    act(() => {
      callbacks.show?.({ endCoordinates: { height: 340 } });
    });
    rerender({ count: 3 });

    // Assert: the height state change retriggered the scroll adjustment.
    expect(scrollTo).toHaveBeenCalledWith(
      expect.objectContaining({ animated: true, y: expect.any(Number) })
    );
  });

  it('does not scroll when the dropdown is closed', () => {
    // Arrange
    setupKeyboardListeners();
    const scrollTo = jest.fn();
    const scrollRef = {
      current: { scrollTo } as unknown as ScrollView,
    };

    // Act
    renderHook(() =>
      useAddressAutocompleteKeyboard({
        isOpen: false,
        predictionCount: 3,
        scrollOffsetRef: { current: 0 },
        scrollRef,
        wrapperRef: createWrapperRef(400, 52),
      })
    );

    // Assert
    expect(scrollTo).not.toHaveBeenCalled();
  });
});
