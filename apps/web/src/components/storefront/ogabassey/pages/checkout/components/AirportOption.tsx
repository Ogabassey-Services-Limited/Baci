'use client';

interface AirportOptionProps {
  type: 'delivery' | 'pickup';
  label: string;
  description: string;
  price: string;
  airportType: 'delivery' | 'pickup';
  setAirportType: (value: 'delivery' | 'pickup') => void;
}

export function AirportOption({
  type,
  label,
  description,
  price,
  airportType,
  setAirportType,
}: AirportOptionProps) {
  const selected = airportType === type;

  return (
    <label
      className={`relative flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all focus-within:ring-2 focus-within:ring-store-primary focus-within:ring-offset-2 ${
        selected
          ? 'border-store-primary bg-store-primary/5'
          : 'border-store-background-text/15 bg-store-background hover:border-store-background-text/25'
      }`}
    >
      <input
        type="radio"
        name="airportType"
        value={type}
        checked={selected}
        onChange={() => setAirportType(type)}
        className="sr-only"
      />
      <div
        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
          selected ? 'border-store-primary' : 'border-store-background-text/40'
        }`}
      >
        {selected && <div className="size-2.5 rounded-full bg-store-primary" />}
      </div>
      <div className="flex-1">
        <p className="font-bold text-store-background-text text-sm">{label}</p>
        <p className="text-xs text-store-background-text/55 mt-0.5">
          {description}
        </p>
      </div>
      <span className="font-bold text-store-background-text">{price}</span>
    </label>
  );
}
