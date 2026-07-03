import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import type { ChangeEvent } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@gorhom/bottom-sheet', async () => {
  const React = await import('react');

  return {
    BottomSheetTextInput: React.forwardRef<
      HTMLInputElement,
      {
        accessibilityLabel?: string;
        onChangeText?: (value: string) => void;
        value?: string;
      }
    >(({ accessibilityLabel, onChangeText, value }, ref) => (
      <input
        aria-label={accessibilityLabel}
        data-sheet-text-input="true"
        onChange={(event: ChangeEvent<HTMLInputElement>) =>
          onChangeText?.(event.target.value)
        }
        ref={ref}
        value={value ?? ''}
      />
    )),
  };
});

import { SheetTextInput } from './SheetTextInput';

describe('SheetTextInput', () => {
  it('uses Gorhom BottomSheetTextInput as the shared sheet input', () => {
    render(
      <SheetTextInput
        accessibilityLabel="Sheet field"
        onChangeText={vi.fn()}
        value="Ada"
      />
    );

    expect(
      screen.getByRole('textbox', { name: 'Sheet field' })
    ).toHaveAttribute('data-sheet-text-input', 'true');
  });
});
