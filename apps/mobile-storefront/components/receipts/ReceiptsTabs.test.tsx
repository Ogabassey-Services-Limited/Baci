import { jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import Colors from '@/constants/Colors';
import { ReceiptsTabs } from './ReceiptsTabs';

// PagerView is a native component — render it as a plain container that exposes
// a no-op setPage so the ref call in goToTab doesn't throw.
jest.mock('react-native-pager-view', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } =
    jest.requireActual<typeof import('react-native')>('react-native');
  return {
    __esModule: true,
    default: React.forwardRef(
      (props: { children?: React.ReactNode }, ref: React.Ref<unknown>) => {
        React.useImperativeHandle(ref, () => ({ setPage: jest.fn() }));
        return React.createElement(View, null, props.children);
      }
    ),
  };
});

jest.mock('./UtilitiesReceiptsView', () => {
  const { Text: MockText } =
    jest.requireActual<typeof import('react-native')>('react-native');
  return {
    UtilitiesReceiptsView: () => (
      <MockText testID="utilities-view">Utilities receipts</MockText>
    ),
  };
});

describe('ReceiptsTabs', () => {
  it('renders the Devices tab content and starts on Devices', () => {
    render(
      <ReceiptsTabs
        colors={Colors.light}
        devicesContent={<Text testID="devices-view">Devices content</Text>}
      />
    );

    expect(screen.getByTestId('devices-view')).toBeOnTheScreen();
    expect(
      screen.getByLabelText('Devices receipts').props.accessibilityState
    ).toEqual({ selected: true });
    expect(
      screen.getByLabelText('Utilities receipts').props.accessibilityState
    ).toEqual({ selected: false });
  });

  it('selects the Utilities tab when its segment is pressed', () => {
    render(
      <ReceiptsTabs
        colors={Colors.light}
        devicesContent={<Text testID="devices-view">Devices content</Text>}
      />
    );

    fireEvent.press(screen.getByLabelText('Utilities receipts'));

    expect(
      screen.getByLabelText('Utilities receipts').props.accessibilityState
    ).toEqual({ selected: true });
    expect(screen.getByTestId('utilities-view')).toBeOnTheScreen();
  });
});
