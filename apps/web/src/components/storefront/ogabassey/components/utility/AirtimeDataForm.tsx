'use client';

import { Loader2, Smartphone } from 'lucide-react';
import { useEffect, useState } from 'react';
import { detectNetworkProvider } from '@/lib/detect-network-provider';
import { cn } from '@/lib/utils';

type Provider = {
  id: string;
  name: string;
  color: string;
};

const AIRTIME_PROVIDERS: Provider[] = [
  { id: 'MTN', name: 'MTN', color: '#FFCC00' },
  { id: 'AIRTEL', name: 'Airtel', color: '#FF0000' },
  { id: 'GLO', name: 'Glo', color: '#00FF00' },
  { id: '9MOBILE', name: '9mobile', color: '#006400' },
];

interface AirtimeDataFormProps {
  type: 'airtime' | 'data';
  loading: boolean;
  onSubmit: (data: {
    phoneNumber: string;
    amount: number;
    networkProvider: string;
    dataPlanCode?: string;
  }) => void;
}

export function AirtimeDataForm({
  type,
  loading,
  onSubmit,
}: AirtimeDataFormProps) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);

  // Auto-detect network from phone number
  useEffect(() => {
    if (phoneNumber.length >= 4) {
      const detected = detectNetworkProvider(phoneNumber);
      if (detected) {
        setSelectedProvider(detected);
      }
    }
  }, [phoneNumber]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProvider || !amount || !phoneNumber) return;
    onSubmit({
      phoneNumber,
      amount: Number(amount),
      networkProvider: selectedProvider,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-1.5">
        <label htmlFor="phone-number" className="text-sm font-medium text-gray-700">
          Phone Number
        </label>
        <div className="relative">
          <Smartphone
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            size={18}
          />
          <input
            id="phone-number"
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="08012345678"
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:border-red-600 focus:ring-1 focus:ring-red-600 outline-hidden transition-all"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3" role="radiogroup" aria-label="Network Provider">
        {AIRTIME_PROVIDERS.map((provider) => (
          <button
            key={provider.id}
            type="button"
            role="radio"
            aria-checked={selectedProvider === provider.id}
            onClick={() => setSelectedProvider(provider.id)}
            className={cn(
              'flex flex-col items-center justify-center p-2 rounded-xl border-2 transition-all aspect-square',
              selectedProvider === provider.id
                ? 'border-red-600 bg-red-50'
                : 'border-gray-100 hover:border-gray-200'
            )}
          >
            <div
              className="w-8 h-8 rounded-full mb-1"
              style={{ backgroundColor: provider.color }}
            />
            <span className="text-[10px] font-bold text-gray-700">
              {provider.name}
            </span>
          </button>
        ))}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="airtime-amount" className="text-sm font-medium text-gray-700">Amount</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">
            ₦
          </span>
          <input
            id="airtime-amount"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full pl-8 pr-4 py-3 rounded-xl border border-gray-200 focus:border-red-600 focus:ring-1 focus:ring-red-600 outline-hidden transition-all"
            required
            min="50"
          />
        </div>
        <div className="flex gap-2">
          {[100, 200, 500, 1000].map((amt) => (
            <button
              key={amt}
              type="button"
              onClick={() => setAmount(String(amt))}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1 hover:bg-gray-50 hover:border-gray-300 transition-colors"
            >
              ₦{amt}
            </button>
          ))}
        </div>
      </div>

      <button
        type="submit"
        disabled={loading || !selectedProvider}
        className="w-full bg-red-600 text-white font-bold py-4 rounded-xl hover:bg-red-700 transition-all shadow-lg shadow-red-900/20 active:scale-95 disabled:opacity-70 disabled:scale-100 flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <Loader2 className="animate-spin" size={20} />
            Processing...
          </>
        ) : (
          <>Pay ₦{amount ? Number(amount).toLocaleString() : '0.00'}</>
        )}
      </button>

      <p className="text-center text-xs text-gray-400">
        Secured by Kuda Bank
      </p>
    </form>
  );
}
