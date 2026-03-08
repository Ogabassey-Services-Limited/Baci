import { AlertCircle, Check, X } from 'lucide-react';
import type { NormalizedProductDetails } from './product-details-helpers';

interface SelectionRequiredModalProps {
  effectiveAxes: string[];
  formatAxisLabel: (axis: string) => string;
  getAxisOptions: (axis: string) => string[];
  isOpen: boolean;
  missingFields: string[];
  onClose: () => void;
  onConfirm: () => void;
  onSelectAttribute: (axis: string, value: string) => void;
  onSelectColor: (index: number) => void;
  productData: NormalizedProductDetails;
  selectedAttributes: Record<string, string>;
  selectedColor: number | null;
}

export function SelectionRequiredModal({
  effectiveAxes,
  formatAxisLabel,
  getAxisOptions,
  isOpen,
  missingFields,
  onClose,
  onConfirm,
  onSelectAttribute,
  onSelectColor,
  productData,
  selectedAttributes,
  selectedColor,
}: SelectionRequiredModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center px-0 md:items-center md:px-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 w-full animate-in slide-in-from-bottom-10 rounded-t-2xl bg-white shadow-2xl duration-300 md:max-w-md md:rounded-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 p-4">
          <h3
            className={`flex items-center gap-2 text-lg font-bold ${
              missingFields.length === 0 ? 'text-green-600' : 'text-gray-900'
            }`}
          >
            {missingFields.length === 0 ? (
              <>
                <Check size={20} /> All Set
              </>
            ) : (
              <>
                <AlertCircle className="text-red-600" size={20} />
                Select Options
              </>
            )}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 hover:bg-gray-100"
            aria-label="Close"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <div className="space-y-6 p-6">
          <p className="text-sm text-gray-500">
            {missingFields.length === 0
              ? "Perfect! You're ready to go."
              : 'Please select the following options to proceed:'}
          </p>

          {(missingFields.includes('Color') || missingFields.length === 0) && (
            <div>
              <label className="mb-3 block text-sm font-bold text-gray-900">
                Color
              </label>
              <div className="flex flex-wrap gap-4">
                {productData.colors.map((color, index) => {
                  const isSelected = selectedColor === index;
                  const isLight = ['#f2f2f2', '#ffffff', '#Bfb7ad'].includes(
                    color.value
                  );

                  return (
                    <button
                      key={color.name}
                      type="button"
                      onClick={() => onSelectColor(index)}
                      className={`group relative flex h-14 w-14 items-center justify-center rounded-full transition-all duration-300 outline-none focus:ring-4 focus:ring-red-100 active:scale-95 ${
                        isSelected
                          ? 'scale-110 border-[3px] border-red-600 shadow-lg'
                          : 'border border-gray-200 shadow-sm md:hover:scale-105 md:hover:border-gray-400'
                      }`}
                    >
                      <div
                        className="h-11 w-11 rounded-full border border-black/5 shadow-inner"
                        style={{ backgroundColor: color.value }}
                      />
                      {isSelected && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center">
                          <Check
                            size={20}
                            className={isLight ? 'text-gray-900' : 'text-white'}
                            strokeWidth={3}
                          />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {effectiveAxes
            .filter((axis) => axis !== 'color')
            .map((axis) => {
              const label = formatAxisLabel(axis);
              const options = getAxisOptions(axis);
              if (options.length === 0) {
                return null;
              }
              if (!missingFields.includes(label) && missingFields.length > 0) {
                return null;
              }

              return (
                <div key={axis}>
                  <label className="mb-3 block text-sm font-bold text-gray-900">
                    {label}
                  </label>
                  <div className="flex flex-wrap gap-3">
                    {options.map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => onSelectAttribute(axis, value)}
                        className={`rounded-xl border px-4 py-3 text-sm font-bold transition-all active:scale-95 ${
                          selectedAttributes[axis] === value
                            ? 'border-red-600 bg-red-50 text-red-700 ring-2 ring-red-100'
                            : 'border-gray-200 bg-gray-50 text-gray-700'
                        }`}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
        </div>

        <div className="border-t border-gray-100 bg-gray-50 p-4 md:rounded-b-2xl">
          <button
            type="button"
            onClick={onConfirm}
            disabled={missingFields.length > 0}
            className="w-full rounded-xl bg-red-600 py-3.5 font-bold text-white shadow-lg transition-all active:scale-[0.98] disabled:bg-gray-300 disabled:text-gray-500 disabled:shadow-none hover:bg-red-700"
          >
            {missingFields.length > 0
              ? `Select ${missingFields.length} more option${
                  missingFields.length > 1 ? 's' : ''
                }`
              : 'Add to Cart Now'}
          </button>
        </div>
      </div>
    </div>
  );
}
