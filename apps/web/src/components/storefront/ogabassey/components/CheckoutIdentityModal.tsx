'use client';

import { AlertCircle, Loader2, User, UserPlus, X, Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { buildCheckoutIdentityRoutes } from '@/components/storefront/checkout-route';
import { useMerchantSafe } from '@/hooks/use-merchant-client';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

interface CheckoutIdentityModalProps {
  isOpen: boolean;
  onClose: () => void;
  checkoutUrl: string;
}

/**
 * Ogabassey-styled Checkout Identity Modal
 * 2026 Best Practice: Native modal with brand-consistent design
 * - Body scroll lock when open
 * - z-100 to overlay bottom nav bar
 * Matches the UtilityModal and NegotiationModal styling patterns
 */
export function CheckoutIdentityModal({
  isOpen,
  onClose,
  checkoutUrl,
}: CheckoutIdentityModalProps) {
  const [activeTab, setActiveTab] = useState<'new' | 'signin'>('new');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();
  const supabase = createClient();
  const merchantContext = useMerchantSafe();
  const _merchant = merchantContext?.merchant;
  const { checkoutUrl: normalizedCheckoutUrl, signupUrl } =
    buildCheckoutIdentityRoutes(checkoutUrl);

  // 2026 Best Practice: Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      // Store current scroll position and lock body
      const scrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';

      return () => {
        // Restore scroll position when modal closes
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        document.body.style.overflow = '';
        window.scrollTo(0, scrollY);
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (loginError) throw loginError;

      // Successful login - proceed to checkout
      router.push(normalizedCheckoutUrl);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in');
      setIsLoading(false);
    }
  };

  const handleGuestCheckout = () => {
    router.push(normalizedCheckoutUrl);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-100 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-300">

        {/* Header */}
        <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-b border-gray-100">
          <h3 className="font-bold text-lg text-gray-900">Checkout</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-full transition-colors"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          <button
            onClick={() => setActiveTab('new')}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-3.5 font-bold text-sm transition-colors border-b-2",
              activeTab === 'new'
                ? "border-red-600 text-red-600 bg-red-50/50"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            )}
          >
            <UserPlus size={16} />
            New Customer
          </button>
          <button
            onClick={() => setActiveTab('signin')}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-3.5 font-bold text-sm transition-colors border-b-2",
              activeTab === 'signin'
                ? "border-red-600 text-red-600 bg-red-50/50"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            )}
          >
            <User size={16} />
            Sign In
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {activeTab === 'new' ? (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-200">
              {/* Guest Checkout - Primary Option */}
              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:border-red-200 transition-all">
                <h4 className="font-bold text-gray-900 mb-1 flex items-center gap-2">
                  <Zap size={16} className="text-amber-500 fill-amber-500" />
                  Guest Checkout
                </h4>
                <p className="text-xs text-gray-500 mb-4">
                  Fastest way to checkout. Create an account later if you wish.
                </p>
                <button
                  onClick={handleGuestCheckout}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 rounded-xl text-sm shadow-lg active:scale-[0.98] transition-all"
                >
                  Continue as Guest
                </button>
              </div>

              {/* Divider */}
              <div className="relative py-1">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-3 text-gray-400 font-medium">or</span>
                </div>
              </div>

              {/* Create Account - Secondary Option */}
              <div className="p-4 bg-red-50/50 rounded-2xl border border-red-100 text-center">
                <h4 className="font-bold text-gray-900 mb-1 flex items-center justify-center gap-2">
                  <UserPlus size={16} className="text-red-600" />
                  Create Account
                </h4>
                <p className="text-xs text-gray-600 mb-4">
                  Save your details for faster checkout next time.
                </p>
                <button
                  onClick={() => router.push(signupUrl)}
                  className="w-full border-2 border-red-600 text-red-600 hover:bg-red-50 font-bold py-3.5 rounded-xl text-sm transition-all"
                >
                  Register Now
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4 animate-in fade-in slide-in-from-left-2 duration-200">
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm">
                  <AlertCircle size={16} />
                  <span className="font-medium">{error}</span>
                </div>
              )}

              {/* Email */}
              <div className="space-y-1.5">
                <label htmlFor="checkout-email" className="text-sm font-medium text-gray-700">Email Address</label>
                <input
                  id="checkout-email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-red-600 focus:ring-1 focus:ring-red-600 outline-hidden transition-all text-sm"
                />
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="checkout-password" className="text-sm font-medium text-gray-700">Password</label>
                  <button
                    type="button"
                    onClick={() => router.push('/forgot-password')}
                    className="text-xs font-bold text-red-600 hover:underline"
                  >
                    Forgot?
                  </button>
                </div>
                <div className="relative">
                  <input
                    id="checkout-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full px-4 py-3 pr-12 rounded-xl border border-gray-200 focus:border-red-600 focus:ring-1 focus:ring-red-600 outline-hidden transition-all text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs font-medium"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-bold py-3.5 rounded-xl text-sm shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    <User size={16} />
                    Sign In & Checkout
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-3 text-center border-t border-gray-100">
          <p className="text-[10px] text-gray-400 font-medium">
            🔒 Your security is our priority. All transactions are encrypted.
          </p>
        </div>
      </div>
    </div>
  );
}
