/**
 * OtpCodeInput Component
 *
 * 2026 Best Practices:
 * - Full accessibility with aria labels
 * - Keyboard navigation support
 * - Paste handling
 * - Auto-focus management
 */

import { Input } from '@/components/ui/input';
import type { OtpCodeInputProps } from '../types';

const OTP_SLOTS = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6'] as const;

/**
 * Six-digit OTP code input with auto-advance
 */
export function OtpCodeInput({
  code,
  onCodeChange,
  onKeyDown,
  onPaste,
  isDisabled,
  inputRefs,
}: OtpCodeInputProps & {
  inputRefs: React.MutableRefObject<(HTMLInputElement | null)[]>;
}) {
  return (
    <div className="flex gap-2 justify-center" onPaste={onPaste}>
      {OTP_SLOTS.map((slot, index) => (
        <Input
          key={slot}
          ref={(el) => {
            inputRefs.current[index] = el;
          }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={code[index]}
          onChange={(e) => onCodeChange(index, e.target.value)}
          onKeyDown={(e) => onKeyDown(index, e)}
          className="w-12 h-14 text-center text-2xl font-mono bg-gray-50 border-gray-200 text-gray-900 focus:border-gray-300 rounded-xl focus-visible:ring-primary/40"
          disabled={isDisabled}
          autoFocus={index === 0}
          aria-label={`Digit ${index + 1} of 6`}
        />
      ))}
    </div>
  );
}
