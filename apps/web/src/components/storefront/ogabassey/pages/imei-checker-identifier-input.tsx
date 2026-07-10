'use client';

import { ScanBarcode } from 'lucide-react';
import {
  isValidDeviceIdentifier,
  type ImeiIdentifierType,
} from '@baci/shared/imei';

interface ImeiCheckerIdentifierInputProps {
  identifier: ImeiIdentifierType;
  value: string;
  onChange: (value: string) => void;
}

const PLACEHOLDER_BY_IDENTIFIER: Record<ImeiIdentifierType, string> = {
  imei: 'Enter 15-digit IMEI Number',
  serial: 'Enter serial number',
  both: 'Enter IMEI or serial number',
};

const LABEL_BY_IDENTIFIER: Record<ImeiIdentifierType, string> = {
  imei: 'IMEI number',
  serial: 'Serial number',
  both: 'IMEI or serial number',
};

/**
 * Identifier-adaptive text input: a numeric keyboard hint for IMEI-only
 * tiers, free text for serial/both so alphanumeric Apple serials can be
 * typed. Validation/normalization happens upstream (the caller applies
 * normalizeDeviceIdentifier on change) — this is a plain controlled input.
 */
export function ImeiCheckerIdentifierInput({
  identifier,
  value,
  onChange,
}: ImeiCheckerIdentifierInputProps) {
  const isComplete = isValidDeviceIdentifier(value, identifier);

  return (
    <div className="relative flex-1">
      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
        <ScanBarcode
          className={
            isComplete ? 'text-[var(--store-primary)]' : 'text-gray-400'
          }
          size={20}
        />
      </div>
      <input
        aria-label={LABEL_BY_IDENTIFIER[identifier]}
        className="w-full rounded-2xl border border-transparent bg-gray-50 py-4 pl-12 pr-4 font-mono text-lg tracking-widest text-gray-900 outline-none transition-all placeholder:font-sans placeholder:tracking-normal hover:bg-white focus:border-[var(--store-primary)]/10 focus:bg-white focus:ring-4 focus:ring-[var(--store-primary)]/10"
        inputMode={identifier === 'imei' ? 'numeric' : 'text'}
        onChange={(event) => onChange(event.target.value)}
        placeholder={PLACEHOLDER_BY_IDENTIFIER[identifier]}
        type="text"
        value={value}
      />
    </div>
  );
}
