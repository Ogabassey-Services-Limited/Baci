import { fireEvent, render, screen } from '@testing-library/react-native';
import { DrawerMenuItems } from './DrawerMenuItems';

jest.mock('@expo/vector-icons', () => {
  const React = jest.requireActual('react');
  const { Text } = jest.requireActual('react-native');

  return {
    Ionicons: ({ name }: { name: string }) =>
      React.createElement(Text, null, name),
  };
});

const colors = {
  icon: '#111827',
  text: '#111827',
  textSecondary: '#4B5563',
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
});
