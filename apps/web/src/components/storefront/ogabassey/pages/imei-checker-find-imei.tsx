const IMEI_STEPS = [
  'Dial *#06#',
  'Copy the 15-digit number',
  'Paste above & verify',
];

export const ImeiCheckerFindImei = () => (
  <div className="mt-6 text-center">
    <p className="text-sm text-gray-500 mb-3">How to find your IMEI:</p>
    <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8 text-sm text-gray-600">
      {IMEI_STEPS.map((label, index) => (
        <div className="flex items-center gap-2" key={label}>
          <span className="w-7 h-7 bg-[var(--store-primary)]/10 text-[var(--store-primary)] rounded-full flex items-center justify-center text-xs font-bold">
            {index + 1}
          </span>
          <span>{label}</span>
        </div>
      ))}
    </div>
  </div>
);
