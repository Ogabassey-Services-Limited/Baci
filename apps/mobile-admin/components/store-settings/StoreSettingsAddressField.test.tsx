import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LIGHT_COLORS, SHADOWS } from '@/constants/theme';
import { StoreSettingsAddressField } from './StoreSettingsAddressField';

const nativeState = vi.hoisted(() => ({
  dismissKeyboard: vi.fn(),
  virtualizedListRenderCount: 0,
}));

vi.mock('react-native', async () => {
  const ReactModule = await import('react');

  return {
    FlatList: () => {
      nativeState.virtualizedListRenderCount += 1;
      return ReactModule.createElement('div', {
        'aria-label': 'Virtualized address suggestions',
      });
    },
    Keyboard: { dismiss: nativeState.dismissKeyboard },
    Pressable: ({
      accessibilityLabel,
      children,
      onPress,
    }: {
      accessibilityLabel?: string;
      children?: React.ReactNode;
      onPress?: () => void;
    }) =>
      ReactModule.createElement(
        'button',
        {
          'aria-label': accessibilityLabel,
          onClick: () => onPress?.(),
          type: 'button',
        },
        children
      ),
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
    },
    Text: ({ children }: { children?: React.ReactNode }) =>
      ReactModule.createElement('span', null, children),
    TextInput: ({
      accessibilityLabel,
      onBlur,
      onChangeText,
      onFocus,
      placeholder,
      value,
    }: {
      accessibilityLabel?: string;
      onBlur?: () => void;
      onChangeText?: (value: string) => void;
      onFocus?: () => void;
      placeholder?: string;
      value?: string;
    }) =>
      ReactModule.createElement('input', {
        'aria-label': accessibilityLabel,
        onBlur,
        onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
          onChangeText?.(event.target.value),
        onFocus,
        placeholder,
        value: value ?? '',
      }),
    View: ({ children }: { children?: React.ReactNode }) =>
      ReactModule.createElement('div', null, children),
  };
});

describe('StoreSettingsAddressField', () => {
  beforeEach(() => {
    nativeState.dismissKeyboard.mockReset();
    nativeState.virtualizedListRenderCount = 0;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('shows country-restricted suggestions without mounting a VirtualizedList', async () => {
    const onAddressChange = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({
        predictions: [
          {
            description: '12 Allen Avenue, Ikeja, Lagos',
            place_id: 'place-1',
            structured_formatting: {
              main_text: '12 Allen Avenue',
              secondary_text: 'Ikeja, Lagos',
            },
          },
        ],
        status: 'OK',
      }),
      ok: true,
      status: 200,
    });
    vi.stubGlobal('fetch', fetchMock);

    const view = render(
      <StoreSettingsAddressField
        address=""
        colors={LIGHT_COLORS}
        countryCode="NG"
        googleMapsApiKey="maps-test-key"
        onAddressChange={onAddressChange}
        shadowStyle={SHADOWS.sm}
      />
    );
    const input = screen.getByLabelText('Business Address');

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '12 Allen Avenue' } });
    view.rerender(
      <StoreSettingsAddressField
        address="12 Allen Avenue"
        colors={LIGHT_COLORS}
        countryCode="NG"
        googleMapsApiKey="maps-test-key"
        onAddressChange={onAddressChange}
        shadowStyle={SHADOWS.sm}
      />
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        'https://maps.googleapis.com/maps/api/place/autocomplete/json?input=12+Allen+Avenue&key=maps-test-key&language=en&components=country%3Ang',
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });

    expect(nativeState.virtualizedListRenderCount).toBe(0);
    expect(screen.getByText('12 Allen Avenue')).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Use address 12 Allen Avenue, Ikeja, Lagos',
      })
    );

    expect(onAddressChange).toHaveBeenLastCalledWith(
      '12 Allen Avenue, Ikeja, Lagos'
    );
    expect(nativeState.dismissKeyboard).toHaveBeenCalledTimes(1);
  });

  it('keeps manual entry available when Google Maps is not configured', () => {
    const onAddressChange = vi.fn();

    render(
      <StoreSettingsAddressField
        address="12 Allen Avenue"
        colors={LIGHT_COLORS}
        countryCode="NG"
        googleMapsApiKey={undefined}
        onAddressChange={onAddressChange}
        shadowStyle={SHADOWS.sm}
      />
    );

    fireEvent.change(screen.getByLabelText('Business Address'), {
      target: { value: '14 Bode Thomas' },
    });

    expect(onAddressChange).toHaveBeenCalledWith('14 Bode Thomas');
    expect(
      screen.queryByLabelText('Address suggestions')
    ).not.toBeInTheDocument();
  });

  it('fails quietly when Google Places cannot return suggestions', async () => {
    const warnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    vi.stubGlobal('__DEV__', true);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ json: vi.fn(), ok: false, status: 500 })
    );

    const view = render(
      <StoreSettingsAddressField
        address=""
        colors={LIGHT_COLORS}
        countryCode="NG"
        googleMapsApiKey="maps-test-key"
        onAddressChange={vi.fn()}
        shadowStyle={SHADOWS.sm}
      />
    );
    const input = screen.getByLabelText('Business Address');

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '12 Allen' } });
    view.rerender(
      <StoreSettingsAddressField
        address="12 Allen"
        colors={LIGHT_COLORS}
        countryCode="NG"
        googleMapsApiKey="maps-test-key"
        onAddressChange={vi.fn()}
        shadowStyle={SHADOWS.sm}
      />
    );

    await waitFor(() => {
      expect(warnSpy).toHaveBeenCalledWith(
        '[StoreSettingsAddressField] Places lookup failed',
        expect.objectContaining({ error: expect.any(Error) })
      );
    });
    expect(
      screen.queryByLabelText('Address suggestions')
    ).not.toBeInTheDocument();
  });
});
