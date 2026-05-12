'use client';

import { Check, Smartphone, Tv, Wallet, Wifi, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useMerchantSafe } from '@/hooks/use-merchant-client';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { AirtimeDataForm } from './utility/AirtimeDataForm';
import { BillPaymentForm } from './utility/BillPaymentForm';

interface UtilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'airtime' | 'data' | 'tv' | 'power' | 'betting';
}

const TABS = [
  { id: 'airtime', icon: Smartphone, label: 'Airtime' },
  { id: 'data', icon: Wifi, label: 'Data' },
  { id: 'tv', icon: Tv, label: 'TV' },
  { id: 'power', icon: Zap, label: 'Power' },
  { id: 'betting', icon: Wallet, label: 'Betting' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export const UtilityModal = ({
  isOpen,
  onClose,
  initialTab = 'airtime',
}: UtilityModalProps) => {
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'details' | 'success'>('details');
  const [transactionRef, setTransactionRef] = useState('');
  const [successAmount, setSuccessAmount] = useState(0);

  const merchantContext = useMerchantSafe();
  const merchant = merchantContext?.merchant;

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setStep('details');
    }
  }, [isOpen, initialTab]);

  const handlePurchase = async (payload: Record<string, unknown>) => {
    setLoading(true);
    try {
      const response = await fetch('/api/vtu/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchantSlug: merchant?.slug || 'ogabassey',
          source: 'storefront_modal',
          ...payload,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Transaction failed');

      setTransactionRef(data.reference);
      setSuccessAmount(data.amount);
      setStep('success');
      toast({
        title: 'Purchase Successful',
        description: `Your ${activeTab} purchase was successful!`,
      });
    } catch (error) {
      toast({
        title: 'Transaction Failed',
        description:
          error instanceof Error ? error.message : 'Something went wrong',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAirtimeDataSubmit = (data: {
    phoneNumber: string;
    amount: number;
    networkProvider: string;
    dataPlanCode?: string;
  }) => {
    handlePurchase({
      type: activeTab,
      phoneNumber: data.phoneNumber,
      amount: data.amount,
      networkProvider: data.networkProvider,
      dataPlanCode: data.dataPlanCode,
    });
  };

  const handleBillSubmit = (data: {
    amount: number;
    billItemIdentifier: string;
    customerIdentifier: string;
    billerName: string;
    type: string;
  }) => {
    handlePurchase({
      type: data.type,
      amount: data.amount,
      billItemIdentifier: data.billItemIdentifier,
      customerIdentifier: data.customerIdentifier,
      billerName: data.billerName,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-b border-gray-100">
          <h3 className="font-bold text-lg text-gray-900">Utility Payment</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <span className="sr-only">Close</span>
            <svg
              width="24"
              height="24"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 overflow-x-auto no-scrollbar">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setStep('details');
              }}
              className={cn(
                'flex-1 flex flex-col items-center gap-1 py-3 px-4 min-w-[80px] transition-colors border-b-2',
                activeTab === tab.id
                  ? 'border-red-600 text-red-600 bg-red-50/50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              )}
            >
              <tab.icon size={18} />
              <span className="text-xs font-medium">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6">
          {step === 'success' ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check size={32} />
              </div>
              <h4 className="text-xl font-bold text-gray-900 mb-2">
                Success!
              </h4>
              <p className="text-gray-500 mb-6">
                Your transaction has been processed successfully.
              </p>
              <div className="bg-gray-50 rounded-lg p-4 mb-6 text-sm">
                <div className="flex justify-between mb-2">
                  <span className="text-gray-500">Service</span>
                  <span className="font-medium capitalize">{activeTab}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-gray-500">Amount</span>
                  <span className="font-medium">
                    ₦{successAmount.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Ref</span>
                  <span className="font-mono text-xs">{transactionRef}</span>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-full bg-red-600 text-white font-bold py-3 rounded-xl hover:bg-red-700 transition-colors"
              >
                Done
              </button>
            </div>
          ) : (
            <>
              {(activeTab === 'airtime' || activeTab === 'data') && (
                <AirtimeDataForm
                  type={activeTab}
                  loading={loading}
                  onSubmit={handleAirtimeDataSubmit}
                />
              )}
              {(activeTab === 'tv' ||
                activeTab === 'power' ||
                activeTab === 'betting') && (
                <BillPaymentForm
                  type={activeTab}
                  loading={loading}
                  onSubmit={handleBillSubmit}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
