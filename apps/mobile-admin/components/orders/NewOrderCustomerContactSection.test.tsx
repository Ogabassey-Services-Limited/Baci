import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { RefObject } from 'react';
import { createRef } from 'react';
import type { CountryCode } from 'react-native-country-picker-modal';
import { describe, expect, it, vi } from 'vitest';
import { createEmptyNewCustomerDraft } from '@/components/orders/new-order.defaults';
import type { SheetTextInputRef } from '@/components/ui/SheetTextInput';
import { LIGHT_COLORS } from '@/constants/theme';
import { NewOrderCustomerContactSection } from './NewOrderCustomerContactSection';
import { DEFAULT_COUNTRY_CODE } from './new-order.shared';
import type { NewCustomerDraft } from './new-order.types';

const keyboardState = vi.hoisted(() => ({
  dismiss: vi.fn(),
}));

vi.mock('@react-native-vector-icons/ionicons', () => ({
  Ionicons: () => null,
  default: () => null,
  __esModule: true,
}));

vi.mock('@gorhom/bottom-sheet', async () => {
  const React = await import('react');

  return {
    BottomSheetTextInput: React.forwardRef(
      (
        {
          accessibilityLabel,
          onChangeText,
          onSubmitEditing,
          placeholder,
          returnKeyType,
          submitBehavior,
          value,
        }: {
          accessibilityLabel?: string;
          onChangeText?: (value: string) => void;
          onSubmitEditing?: () => void;
          placeholder?: string;
          returnKeyType?: string;
          submitBehavior?: string;
          value?: string;
        },
        ref: React.Ref<HTMLInputElement>
      ) =>
        React.createElement('input', {
          'aria-label': accessibilityLabel,
          'data-gorhom-input': 'true',
          'data-return-key-type': returnKeyType,
          'data-submit-behavior': submitBehavior,
          onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
            onChangeText?.(event.target.value),
          onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => {
            if (event.key === 'Enter') {
              onSubmitEditing?.();
            }
          },
          placeholder,
          ref,
          value: value ?? '',
        })
    ),
  };
});

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    StatusBar: () => null,
    Keyboard: { dismiss: keyboardState.dismiss },
    Pressable: ({
      accessibilityLabel,
      accessibilityState,
      children,
      onPress,
    }: {
      accessibilityLabel?: string;
      accessibilityState?: { expanded?: boolean; selected?: boolean };
      children?: React.ReactNode;
      onPress?: () => void;
    }) =>
      React.createElement(
        'button',
        {
          'aria-expanded': accessibilityState?.expanded,
          'aria-label': accessibilityLabel,
          'aria-selected': accessibilityState?.selected,
          onClick: () => onPress?.(),
          type: 'button',
        },
        children
      ),
    ScrollView: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
    },
    Text: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', null, children),
    TextInput: React.forwardRef(
      (
        {
          accessibilityLabel,
          onChangeText,
          onSubmitEditing,
          placeholder,
          returnKeyType,
          submitBehavior,
          value,
        }: {
          accessibilityLabel?: string;
          onChangeText?: (value: string) => void;
          onSubmitEditing?: () => void;
          placeholder?: string;
          returnKeyType?: string;
          submitBehavior?: string;
          value?: string;
        },
        ref: React.Ref<HTMLInputElement>
      ) =>
        React.createElement('input', {
          'aria-label': accessibilityLabel,
          'data-return-key-type': returnKeyType,
          'data-submit-behavior': submitBehavior,
          onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
            onChangeText?.(event.target.value),
          onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => {
            if (event.key === 'Enter') {
              onSubmitEditing?.();
            }
          },
          placeholder,
          ref,
          value: value ?? '',
        })
    ),
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

function applyStateUpdate<T>(update: React.SetStateAction<T>, previous: T): T {
  return typeof update === 'function'
    ? (update as (value: T) => T)(previous)
    : update;
}

function renderContactSection() {
  const state = {
    newCustomer: createEmptyNewCustomerDraft(),
    selectedCountryCode: DEFAULT_COUNTRY_CODE,
  };
  const phoneInputRef = createRef<SheetTextInputRef>();
  const emailInputRef = createRef<SheetTextInputRef>();
  const setNewCustomer = vi.fn(
    (value: React.SetStateAction<NewCustomerDraft>) => {
      state.newCustomer = applyStateUpdate(value, state.newCustomer);
    }
  );
  const setSelectedCountryCode = vi.fn(
    (value: React.SetStateAction<CountryCode>) => {
      state.selectedCountryCode = applyStateUpdate(
        value,
        state.selectedCountryCode
      );
    }
  );

  const makeElement = () => (
    <NewOrderCustomerContactSection
      colors={LIGHT_COLORS}
      emailInputRef={emailInputRef as RefObject<SheetTextInputRef | null>}
      newCustomer={state.newCustomer}
      phoneInputRef={phoneInputRef as RefObject<SheetTextInputRef | null>}
      selectedCountryCode={state.selectedCountryCode}
      setNewCustomer={setNewCustomer}
      setSelectedCountryCode={setSelectedCountryCode}
    />
  );
  const view = render(makeElement());

  return {
    rerender: () => view.rerender(makeElement()),
    setNewCustomer,
    setSelectedCountryCode,
    state,
  };
}

describe('NewOrderCustomerContactSection', () => {
  it('formats phone input and moves focus through the keyboard return key', () => {
    const harness = renderContactSection();
    const phoneInput = screen.getByLabelText('Phone Number');
    const emailInput = screen.getByPlaceholderText('Email Address (Optional)');

    expect(phoneInput).toHaveAttribute('data-return-key-type', 'next');
    expect(phoneInput).toHaveAttribute('data-gorhom-input', 'true');
    fireEvent.change(phoneInput, { target: { value: '08012345678' } });
    expect(harness.state.newCustomer.phone).toBe('+2348012345678');

    harness.rerender();
    fireEvent.keyDown(screen.getByLabelText('Phone Number'), { key: 'Enter' });
    expect(emailInput).toHaveFocus();

    fireEvent.keyDown(emailInput, { key: 'Enter' });
    expect(keyboardState.dismiss).toHaveBeenCalledTimes(1);
  });

  it('opens a compact country picker and updates the selected country', () => {
    const harness = renderContactSection();

    fireEvent.click(
      screen.getByLabelText('Select phone country, currently Nigeria')
    );
    expect(screen.getByLabelText('Search phone countries')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Use Ghana +233' })
    ).toBeVisible();

    fireEvent.change(screen.getByLabelText('Search phone countries'), {
      target: { value: 'gh' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Use Ghana +233' }));

    expect(harness.setSelectedCountryCode).toHaveBeenCalledWith('GH');
    expect(harness.state.selectedCountryCode).toBe('GH');

    harness.rerender();
    expect(
      screen.getByLabelText('Select phone country, currently Ghana')
    ).toBeInTheDocument();
  });
});
