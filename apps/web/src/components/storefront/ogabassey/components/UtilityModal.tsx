'use client';

import {
    Check,
    Loader2,
    Smartphone,
    Tv,
    Wallet,
    Wifi,
    Zap,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useMerchantSafe } from '@/hooks/use-merchant';
import { detectNetworkProvider } from '@/lib/kuda';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

interface UtilityModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialTab?: 'airtime' | 'data' | 'tv' | 'power' | 'betting';
}

type Provider = {
    id: string;
    name: string;
    logo?: string;
    color?: string;
};

// Mock providers for UI (dynamic loading would be better but this starts it)
const AIRTIME_PROVIDERS: Provider[] = [
    { id: 'MTN', name: 'MTN', color: '#FFCC00' },
    { id: 'AIRTEL', name: 'Airtel', color: '#FF0000' },
    { id: 'GLO', name: 'Glo', color: '#00FF00' },
    { id: '9MOBILE', name: '9mobile', color: '#006400' },
];

export const UtilityModal = ({
    isOpen,
    onClose,
    initialTab = 'airtime',
}: UtilityModalProps) => {
    const [activeTab, setActiveTab] = useState(initialTab);
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState<'details' | 'confirm' | 'success'>('details');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [amount, setAmount] = useState('');
    const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
    const [transactionRef, setTransactionRef] = useState('');

    const merchantContext = useMerchantSafe();
    const merchant = merchantContext?.merchant;

    // Reset state when opening/closing
    useEffect(() => {
        if (isOpen) {
            setActiveTab(initialTab);
            setStep('details');
        }
    }, [isOpen, initialTab]);

    // Network Detection
    useEffect(() => {
        if (activeTab === 'airtime' || activeTab === 'data') {
            if (phoneNumber.length >= 4) {
                const detected = detectNetworkProvider(phoneNumber);
                if (detected) {
                    setSelectedProvider(detected);
                }
            }
        }
    }, [phoneNumber, activeTab]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedProvider || !amount || !phoneNumber) {
            toast({
                title: "Missing fields",
                description: "Please fill in all required fields",
                variant: "destructive"
            });
            return;
        }

        setLoading(true);

        try {
            const response = await fetch('/api/vtu/purchase', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    merchantSlug: merchant?.slug || 'ogabassey',
                    phoneNumber,
                    amount: Number(amount),
                    type: activeTab, // 'airtime' or 'data' mapped correctly in API? API expects 'airtime' | 'data'
                    networkProvider: selectedProvider,
                    source: 'storefront_modal'
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Transaction failed');
            }

            setTransactionRef(data.reference);
            setStep('success');
            toast({
                title: "Purchase Successful",
                description: `Your ${activeTab} purchase was successful!`,
            });

        } catch (error) {
            console.error(error);
            toast({
                title: "Transaction Failed",
                description: error instanceof Error ? error.message : "Something went wrong",
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
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
                        <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-100 overflow-x-auto no-scrollbar">
                    {[
                        { id: 'airtime', icon: Smartphone, label: 'Airtime' },
                        { id: 'data', icon: Wifi, label: 'Data' },
                        { id: 'tv', icon: Tv, label: 'TV' },
                        { id: 'power', icon: Zap, label: 'Power' },
                        { id: 'betting', icon: Wallet, label: 'Betting' },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => {
                                setActiveTab(tab.id as any);
                                setStep('details');
                            }}
                            className={cn(
                                "flex-1 flex flex-col items-center gap-1 py-3 px-4 min-w-[80px] transition-colors border-b-2",
                                activeTab === tab.id
                                    ? "border-red-600 text-red-600 bg-red-50/50"
                                    : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
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
                            <h4 className="text-xl font-bold text-gray-900 mb-2">Success!</h4>
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
                                    <span className="font-medium">₦{Number(amount).toLocaleString()}</span>
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
                        <form onSubmit={handleSubmit} className="space-y-5">

                            {/* Phone Number Input */}
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-gray-700">Phone Number/ID</label>
                                <div className="relative">
                                    <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                    <input
                                        type="tel"
                                        value={phoneNumber}
                                        onChange={(e) => setPhoneNumber(e.target.value)}
                                        placeholder="Enter phone number"
                                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:border-red-600 focus:ring-1 focus:ring-red-600 outline-none transition-all"
                                        required
                                    />
                                </div>
                            </div>

                            {/* Provider Selection */}
                            {(activeTab === 'airtime' || activeTab === 'data') && (
                                <div className="grid grid-cols-4 gap-3">
                                    {AIRTIME_PROVIDERS.map((provider) => (
                                        <button
                                            key={provider.id}
                                            type="button"
                                            onClick={() => setSelectedProvider(provider.id)}
                                            className={cn(
                                                "flex flex-col items-center justify-center p-2 rounded-xl border-2 transition-all aspect-square",
                                                selectedProvider === provider.id
                                                    ? "border-red-600 bg-red-50"
                                                    : "border-gray-100 hover:border-gray-200"
                                            )}
                                        >
                                            <div
                                                className="w-8 h-8 rounded-full mb-1"
                                                style={{ backgroundColor: provider.color }}
                                            />
                                            <span className="text-[10px] font-bold text-gray-700">{provider.name}</span>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Amount Input */}
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-gray-700">Amount</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">₦</span>
                                    <input
                                        type="number"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        placeholder="0.00"
                                        className="w-full pl-8 pr-4 py-3 rounded-xl border border-gray-200 focus:border-red-600 focus:ring-1 focus:ring-red-600 outline-none transition-all"
                                        required
                                        min="50"
                                    />
                                </div>
                                {/* Quick Amounts */}
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

                            {/* Payment Method Stub */}
                            <div className="pt-2">
                                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                                    <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm text-red-600">
                                        <Wallet size={20} />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-bold text-gray-900">Pay from Wallet</p>
                                        <p className="text-xs text-green-600 font-medium">Balance: ₦0.00</p>
                                    </div>
                                    <div className="w-4 h-4 rounded-full border-[5px] border-red-600" />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-red-600 text-white font-bold py-4 rounded-xl hover:bg-red-700 transition-all shadow-lg shadow-red-900/20 active:scale-95 disabled:opacity-70 disabled:scale-100 flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="animate-spin" size={20} />
                                        Processing...
                                    </>
                                ) : (
                                    <>
                                        Pay ₦{amount ? Number(amount).toLocaleString() : '0.00'}
                                    </>
                                )}
                            </button>

                            <p className="text-center text-xs text-gray-400">
                                Secured by Kuda Bank
                            </p>

                        </form>
                    )}
                </div>

            </div>
        </div>
    );
}
