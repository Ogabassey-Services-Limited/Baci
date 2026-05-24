import { jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import Colors from '@/constants/Colors';
import { ProductDetailRouteState } from './ProductDetailRouteState';

describe('ProductDetailRouteState', () => {
  it('renders the loading state', () => {
    render(<ProductDetailRouteState colors={Colors.light} state="loading" />);

    expect(screen.getByText('Loading product...')).toBeTruthy();
  });

  it('renders the invalid-link state and calls the back action', () => {
    const onGoBack = jest.fn();

    render(
      <ProductDetailRouteState
        colors={Colors.light}
        onGoBack={onGoBack}
        state="invalid"
      />
    );

    expect(screen.getByText('Invalid Product Link')).toBeTruthy();
    expect(screen.getByText('Go Back').props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ color: Colors.light.primaryForeground }),
      ])
    );

    fireEvent.press(
      screen.getByRole('button', { name: 'Go back to previous screen' })
    );

    expect(onGoBack).toHaveBeenCalledTimes(1);
  });

  it('uses the primary foreground token for a dark-theme action button', () => {
    render(
      <ProductDetailRouteState
        colors={Colors.dark}
        onGoBack={jest.fn()}
        state="invalid"
      />
    );

    expect(screen.getByText('Go Back').props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ color: Colors.dark.primaryForeground }),
      ])
    );
  });

  it('renders the product error state with the provided message', () => {
    render(
      <ProductDetailRouteState
        colors={Colors.light}
        errorMessage="This product may no longer be available"
        onGoBack={jest.fn()}
        state="error"
      />
    );

    expect(screen.getByText('Product not found')).toBeTruthy();
    expect(
      screen.getByText('This product may no longer be available')
    ).toBeTruthy();
  });

  it('renders the default product error message when no message is provided', () => {
    render(
      <ProductDetailRouteState
        colors={Colors.light}
        onGoBack={jest.fn()}
        state="error"
      />
    );

    expect(screen.getByText('Product not found')).toBeTruthy();
    expect(
      screen.getByText('This product may no longer be available')
    ).toBeTruthy();
  });

  it('renders the offline state and retries when requested', () => {
    const onRetry = jest.fn();

    render(
      <ProductDetailRouteState
        colors={Colors.light}
        onRetry={onRetry}
        state="offline"
      />
    );

    expect(screen.getByText('Product Unavailable Offline')).toBeTruthy();

    fireEvent.press(
      screen.getByRole('button', { name: 'Retry loading content' })
    );

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
