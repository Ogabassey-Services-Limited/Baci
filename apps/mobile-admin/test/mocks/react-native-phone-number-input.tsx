interface PhoneInputMockProps {
  defaultValue?: string;
  onChangeFormattedText?: (value: string) => void;
  textInputProps?: {
    onBlur?: () => void;
    onFocus?: () => void;
    placeholderTextColor?: string;
  };
}

export default function PhoneInputMock({
  defaultValue,
  onChangeFormattedText,
  textInputProps,
}: PhoneInputMockProps) {
  return (
    <input
      aria-label="Phone Number"
      defaultValue={defaultValue ?? ''}
      onBlur={textInputProps?.onBlur}
      onChange={(event) => onChangeFormattedText?.(event.target.value)}
      onFocus={textInputProps?.onFocus}
    />
  );
}
