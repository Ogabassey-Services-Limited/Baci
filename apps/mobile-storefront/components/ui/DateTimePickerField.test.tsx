import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { DateTimePickerField } from './DateTimePickerField';

let mockPickerEventType: 'dismissed' | 'set' = 'set';

type MockDateTimePickerProps = {
  mode: 'date' | 'time';
  onChange: (event: { type: 'dismissed' | 'set' }, date: Date) => void;
};

jest.mock('@react-native-community/datetimepicker', () => {
  return {
    __esModule: true,
    default: ({ mode, onChange }: MockDateTimePickerProps) => {
      const { Pressable, Text } =
        jest.requireActual<typeof import('react-native')>('react-native');

      return (
        <Pressable
          accessibilityLabel={`Mock ${mode} picker`}
          accessibilityRole="button"
          onPress={() =>
            onChange(
              { type: mockPickerEventType },
              mode === 'time'
                ? new Date(2026, 4, 22, 7, 5)
                : new Date(2026, 4, 23)
            )
          }
        >
          <Text>{`${mode} picker`}</Text>
        </Pressable>
      );
    },
  };
});

describe('DateTimePickerField', () => {
  beforeEach(() => {
    mockPickerEventType = 'set';
  });

  it('formats selected time values', () => {
    const onChangeText = jest.fn();
    render(
      <DateTimePickerField
        accessibilityLabel="Savings debit time"
        fallbackDisplay="06:20"
        label="Preferred debit time"
        mode="time"
        onChangeText={onChangeText}
        value="06:20"
      />
    );

    fireEvent.press(screen.getByRole('button', { name: 'Savings debit time' }));
    fireEvent.press(screen.getByRole('button', { name: 'Mock time picker' }));

    expect(onChangeText).toHaveBeenCalledWith('07:05');
  });

  it('formats selected date values', () => {
    const onChangeText = jest.fn();
    render(
      <DateTimePickerField
        accessibilityLabel="Savings start date"
        fallbackDisplay="YYYY-MM-DD"
        label="Start date"
        mode="date"
        onChangeText={onChangeText}
        value="2026-05-22"
      />
    );

    fireEvent.press(screen.getByRole('button', { name: 'Savings start date' }));
    fireEvent.press(screen.getByRole('button', { name: 'Mock date picker' }));

    expect(onChangeText).toHaveBeenCalledWith('2026-05-23');
  });

  it('keeps the iOS picker open after a selection so Continue can submit it', () => {
    if (Platform.OS !== 'ios') return;

    const onChangeText = jest.fn();
    render(
      <DateTimePickerField
        accessibilityLabel="Date of birth"
        fallbackDisplay="Select your date of birth"
        label="Date of birth"
        mode="date"
        onChangeText={onChangeText}
        value="1990-05-22"
      />
    );

    fireEvent.press(screen.getByRole('button', { name: 'Date of birth' }));
    fireEvent.press(screen.getByRole('button', { name: 'Mock date picker' }));

    expect(onChangeText).toHaveBeenCalledWith('2026-05-23');
    expect(
      screen.getByRole('button', { name: 'Mock date picker' })
    ).toBeTruthy();
  });

  it('closes dismissed picker events without changing the value', () => {
    mockPickerEventType = 'dismissed';
    const onChangeText = jest.fn();
    render(
      <DateTimePickerField
        accessibilityLabel="Savings debit time"
        fallbackDisplay="06:20"
        label="Preferred debit time"
        mode="time"
        onChangeText={onChangeText}
        value="06:20"
      />
    );

    fireEvent.press(screen.getByRole('button', { name: 'Savings debit time' }));
    fireEvent.press(screen.getByRole('button', { name: 'Mock time picker' }));

    expect(onChangeText).not.toHaveBeenCalled();
    expect(
      screen.queryByRole('button', { name: 'Mock time picker' })
    ).toBeNull();
  });

  it.each([
    {
      accessibilityLabel: 'Malformed savings start date',
      expected: '2026-05-23',
      fallbackDisplay: 'YYYY-MM-DD',
      label: 'Start date',
      mode: 'date' as const,
      value: 'not-a-real-value',
    },
    {
      accessibilityLabel: 'Malformed savings debit time',
      expected: '07:05',
      fallbackDisplay: '06:20',
      label: 'Preferred debit time',
      mode: 'time' as const,
      value: 'not-a-real-value',
    },
    {
      accessibilityLabel: 'Empty savings start date',
      expected: '2026-05-23',
      fallbackDisplay: 'YYYY-MM-DD',
      label: 'Start date',
      mode: 'date' as const,
      value: '',
    },
    {
      accessibilityLabel: 'Empty savings debit time',
      expected: '07:05',
      fallbackDisplay: '06:20',
      label: 'Preferred debit time',
      mode: 'time' as const,
      value: '',
    },
  ])('still opens the $mode picker and formats selection for malformed values', ({
    accessibilityLabel,
    expected,
    fallbackDisplay,
    label,
    mode,
    value,
  }) => {
    const onChangeText = jest.fn();
    render(
      <DateTimePickerField
        accessibilityLabel={accessibilityLabel}
        fallbackDisplay={fallbackDisplay}
        label={label}
        mode={mode}
        onChangeText={onChangeText}
        value={value}
      />
    );

    fireEvent.press(screen.getByRole('button', { name: accessibilityLabel }));
    fireEvent.press(
      screen.getByRole('button', { name: `Mock ${mode} picker` })
    );

    expect(onChangeText).toHaveBeenCalledWith(expected);
  });
});
