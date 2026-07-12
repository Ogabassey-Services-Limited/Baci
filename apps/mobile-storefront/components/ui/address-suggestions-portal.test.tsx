import { act, fireEvent, render, screen } from '@testing-library/react-native';
import {
  Keyboard,
  type KeyboardEvent,
  Pressable,
  StyleSheet,
  Text,
} from 'react-native';
import Colors from '@/constants/Colors';
import {
  AddressSuggestionsProvider,
  useAddressSuggestionsPortal,
} from './address-suggestions-portal';

const prediction = {
  description: '1 Allen Avenue, Ikeja, Lagos',
  mainText: '1 Allen Avenue',
  placeId: 'place-1',
  secondaryText: 'Ikeja, Lagos',
};

function keyboardEvent(screenY: number): KeyboardEvent {
  return {
    duration: 0,
    easing: 'keyboard',
    endCoordinates: {
      height: 0,
      screenX: 0,
      screenY,
      width: 0,
    },
  };
}

function Harness({ anchorY = 200 }: { anchorY?: number }) {
  const portal = useAddressSuggestionsPortal();
  return (
    <>
      <Pressable
        accessibilityRole="button"
        onPress={() =>
          portal.show({
            anchor: { height: 52, width: 340, x: 16, y: anchorY },
            colors: Colors.light,
            isDark: false,
            onSelect: jest.fn(),
            predictions: [prediction],
          })
        }
      >
        <Text>Show</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={portal.hide}>
        <Text>Hide</Text>
      </Pressable>
    </>
  );
}

describe('AddressSuggestionsProvider', () => {
  afterEach(() => jest.restoreAllMocks());

  it('shows and hides suggestions through the portal API', () => {
    render(
      <AddressSuggestionsProvider>
        <Harness />
      </AddressSuggestionsProvider>
    );

    fireEvent.press(screen.getByRole('button', { name: 'Show' }));
    expect(screen.getByLabelText('Address suggestions')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Hide' }));
    expect(screen.queryByLabelText('Address suggestions')).toBeNull();
  });

  it('positions suggestions above an input hidden by the keyboard', () => {
    let onKeyboardShow:
      | Parameters<typeof Keyboard.addListener>[1]
      | undefined;
    jest
      .spyOn(Keyboard, 'addListener')
      .mockImplementation((event, listener) => {
        if (event === 'keyboardDidShow') onKeyboardShow = listener;
        return { remove: jest.fn() } as unknown as ReturnType<
          typeof Keyboard.addListener
        >;
      });
    render(
      <AddressSuggestionsProvider>
        <Harness anchorY={620} />
      </AddressSuggestionsProvider>
    );
    fireEvent.press(screen.getByRole('button', { name: 'Show' }));

    act(() => onKeyboardShow?.(keyboardEvent(600)));

    const dropdown = screen.getByLabelText('Address suggestions');
    const style = StyleSheet.flatten(dropdown.props.style);
    expect(style.top).toBeLessThan(620);
    expect(style.top + style.maxHeight).toBeLessThanOrEqual(592);
  });

  it('positions suggestions below an input when space is available', () => {
    render(
      <AddressSuggestionsProvider>
        <Harness anchorY={200} />
      </AddressSuggestionsProvider>
    );

    fireEvent.press(screen.getByRole('button', { name: 'Show' }));

    const style = StyleSheet.flatten(
      screen.getByLabelText('Address suggestions').props.style
    );
    expect(style.top).toBe(256);
  });

  it('hides suggestions when no vertical space is available', () => {
    let onKeyboardShow:
      | Parameters<typeof Keyboard.addListener>[1]
      | undefined;
    jest
      .spyOn(Keyboard, 'addListener')
      .mockImplementation((event, listener) => {
        if (event === 'keyboardDidShow') onKeyboardShow = listener;
        return { remove: jest.fn() } as unknown as ReturnType<
          typeof Keyboard.addListener
        >;
      });
    render(
      <AddressSuggestionsProvider>
        <Harness anchorY={0} />
      </AddressSuggestionsProvider>
    );
    fireEvent.press(screen.getByRole('button', { name: 'Show' }));

    act(() => onKeyboardShow?.(keyboardEvent(8)));

    expect(screen.queryByLabelText('Address suggestions')).toBeNull();
  });
});
