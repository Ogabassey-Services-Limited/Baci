import { describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { TabBarIcon, TabBarLabel } from './TabBarComponents';

jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      text: '#000000',
      tabIconDefault: '#cccccc',
      tabIconSelected: '#ff0000',
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

  it('leaves focused icon highlight to the moving tab capsule', () => {
    render(<TabBarIcon name="home" focused={true} />);

    const iconInnerStyle = StyleSheet.flatten(
      screen.getByTestId('tab-bar-icon-inner').props.style
    );

    expect(iconInnerStyle.backgroundColor).toBeUndefined();
    expect(iconInnerStyle.borderColor).toBeUndefined();
    expect(iconInnerStyle.borderWidth).toBeUndefined();
    expect(iconInnerStyle.transform).toBeUndefined();
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
