// Template preview
'use client';

import { useState, useEffect } from 'react';
import { CreditCard, History, Plus, Wallet, Loader2 } from 'lucide-react';
import { EmptyState } from '../components/empty-state';
import { useCustomerAuth } from '@/contexts/customer-auth-context';
import { useMerchantSafe } from '@/hooks/use-merchant-client';

export function OgabasseyV2Wallet() {
  const { isAuthenticated } = useCustomerAuth();
  const { merchant } = useMerchantSafe() || {};

  const [wallet, setWallet] = useState<{
    balance: number;
    totalEarned: number;
    totalRedeemed: number;
    transactions: any[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWallet = async () => {
      if (!isAuthenticated || !merchant?.slug) {
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(
          `/api/storefront/customer/wallet?merchant=${merchant.slug}`
        );
        const data = await res.json();
        setWallet(data);
      } catch (err) {
        console.error('Failed to fetch wallet', err);
      } finally {
        setLoading(false);
      }
    };

    fetchWallet();
  }, [isAuthenticated, merchant?.slug]);

  const handleFundWallet = () => {
    // Placeholder for now as per instructions/limitations
    alert('Wallet funding is currently being updated. Please try again later.');
  };

  const handleAddCard = () => {
    alert('Card management is coming soon.');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-gray-400" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24 md:pb-12 pt-4 md:pt-8 flex flex-col">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 w-full flex-1 flex flex-col">
        {/* Header */}
        <h1 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2 shrink-0">
          <Wallet className="text-red-600 fill-red-600" />
          Wallet
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Balance & Actions */}
          <div className="lg:col-span-5 space-y-6">
            {/* Balance Card */}
            <div className="bg-[#1a1a1a] rounded-2xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden group">
              {/* Pattern Background */}
              <div
                className="absolute inset-0 opacity-10"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                }}
              />

              <div className="relative z-10">
                <p className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-1">
                  Total Balance
                </p>
                <div className="text-4xl md:text-5xl font-bold mb-8">
                  {wallet
                    ? new Intl.NumberFormat('en-NG', {
                      style: 'currency',
                      currency: 'NGN',
                    }).format(wallet.balance)
                    : '₦0.00'}
                </div>

                <div className="flex">
                  <button
                    onClick={handleFundWallet}
                    className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-red-900/20 active:scale-95"
                  >
                    <Plus size={20} /> Fund Wallet
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Actions / Info */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <CreditCard size={18} className="text-gray-400" />
                Saved Cards
              </h3>
              <div
                onClick={handleAddCard}
                className="flex flex-col items-center justify-center py-8 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors"
                role="button"
              >
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm mb-3">
                  <Plus size={24} className="text-gray-400" />
                </div>
                <p className="text-sm font-medium text-gray-600">
                  Add a new card
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  For faster checkout
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Transaction History */}
          <div className="lg:col-span-7 flex flex-col h-full min-h-[400px]">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col flex-1 h-full overflow-hidden">
              <div className="p-6 border-b border-gray-100 flex items-center justify-center md:justify-between">
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                  <History size={18} className="text-gray-400" />
                  Recent Transactions
                </h3>
                {/* Disabled verified view-all for now */}
              </div>

              <div className="flex-1 flex flex-col">
                {wallet && wallet.transactions && wallet.transactions.length > 0 ? (
                  <div className="p-2 space-y-1">
                    {wallet.transactions.map((tx: any) => (
                      <div key={tx.id} className="flex items-center justify-between p-4 hover:bg-gray-50 rounded-lg transition-colors">
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${tx.type === 'credit' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                            {tx.type === 'credit' ? <Plus size={18} /> : <History size={18} />}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 text-sm">{tx.description || 'Transaction'}</p>
                            <p className="text-xs text-gray-500">{new Date(tx.created_at).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <span className={`font-bold text-sm ${tx.type === 'credit' ? 'text-green-600' : 'text-gray-900'}`}>
                          {tx.type === 'credit' ? '+' : '-'} {new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(tx.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <EmptyState
                      variant="wallet"
                      title="No transactions yet"
                      description="Your recent wallet top-ups and purchases will appear here."
                      compact={true}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
