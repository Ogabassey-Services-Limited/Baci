import { fireEvent, render, screen } from '@testing-library/react-native';
import { DrawerMenuItems } from './DrawerMenuItems';

jest.mock('@react-native-vector-icons/ionicons', () => {
  const React = jest.requireActual('react');
  const { Text } = jest.requireActual('react-native');

  return {
    __esModule: true,
    default: ({ name }: { name: string }) =>
      React.createElement(Text, null, name),
  };
});

const colors = {
  icon: '#111827',
  text: '#111827',
  textSecondary: '#4B5563',
  card: '#ffffff',
};

describe('DrawerMenuItems', () => {
  it('hides authenticated menu items for guests and navigates to a selected route', () => {
    const onNavigate = jest.fn();

    render(
      <DrawerMenuItems
        colors={colors}
        isAuthenticated={false}
        pathname="/"
        onNavigate={onNavigate}
      />
    );

    expect(screen.queryByLabelText('My Account')).toBeNull();
    fireEvent.press(screen.getByLabelText('Orders'));
    expect(onNavigate).toHaveBeenCalledWith('/orders');
  });

  it('renders authenticated menu items for signed-in customers', () => {
    render(
      <DrawerMenuItems
        colors={colors}
        isAuthenticated={true}
        pathname="/account"
        onNavigate={jest.fn()}
      />
    );

    expect(screen.getByLabelText('My Account')).toBeTruthy();
  });

  it('marks exact and nested routes as selected', () => {
    const { rerender } = render(
      <DrawerMenuItems
        colors={colors}
        isAuthenticated={true}
        pathname="/orders"
        onNavigate={jest.fn()}
      />
    );

    expect(screen.getByLabelText('Orders').props.accessibilityState).toEqual({
      selected: true,
    });
    expect(
      screen.getByLabelText('My Account').props.accessibilityState
    ).toEqual({ selected: false });

    rerender(
      <DrawerMenuItems
        colors={colors}
        isAuthenticated={true}
        pathname="/account/security"
        onNavigate={jest.fn()}
      />
    );

    expect(
      screen.getByLabelText('My Account').props.accessibilityState
    ).toEqual({ selected: true });
    expect(screen.getByLabelText('Orders').props.accessibilityState).toEqual({
      selected: false,
    });
  });
});
