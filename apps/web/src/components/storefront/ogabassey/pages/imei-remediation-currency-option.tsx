export function ImeiRemediationCurrencyOption({
  checked,
  label,
  onSelect,
  value,
}: {
  checked: boolean;
  label: string;
  onSelect: () => void;
  value: 'NGN' | 'USDT';
}) {
  return (
    <label className="cursor-pointer">
      <input
        checked={checked}
        className="peer sr-only"
        name="imei-remediation-payment-currency"
        onChange={onSelect}
        type="radio"
        value={value}
      />
      <span
        className={`block rounded-xl border p-3 text-left font-bold peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--store-primary,#dc2626)] peer-focus-visible:ring-offset-2 ${checked ? 'border-[var(--store-primary,#dc2626)] bg-[var(--store-primary,#dc2626)]/5' : 'border-[var(--store-border,#e5e7eb)]'}`}
      >
        {label}
      </span>
    </label>
  );
}
