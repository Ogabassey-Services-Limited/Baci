import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { TabBarLabel, TabBarIcon } from './TabBarComponents';

jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      text: '#000000',
      tabIconDefault: '#cccccc',
      selectedIconBackground: '#eeeeee',
      primary: '#ff0000',
      card: '#ffffff',
      primaryForeground: '#ffffff',
    },
  }),
}));

describe('TabBarLabel', () => {
  it('renders nothing when not focused', () => {
    const { toJSON } = render(<TabBarLabel focused={false} label="Home" />);
    expect(toJSON()).toBeNull();
  });

  it('renders label text when focused', () => {
    render(<TabBarLabel focused={true} label="Home" />);
    expect(screen.getByText('Home')).toBeOnTheScreen();
  });
});

describe('TabBarIcon', () => {
  it('renders icon with standard styles', () => {
    const { toJSON } = render(<TabBarIcon name="home" focused={false} />);
    expect(toJSON()).not.toBeNull();
  });

  it('renders badge number when badge is provided', () => {
    render(<TabBarIcon name="home" focused={false} badge={5} />);
    expect(screen.getByText('5')).toBeOnTheScreen();
  });

  it('renders 99+ when badge exceeds 99', () => {
    render(<TabBarIcon name="home" focused={false} badge={150} />);
    expect(screen.getByText('99+')).toBeOnTheScreen();
  });
});
