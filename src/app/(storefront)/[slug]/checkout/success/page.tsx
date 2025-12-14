'use client';

import { motion } from 'framer-motion';
import { AlertCircle, CheckCircle, Loader2, Package } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useCart } from '@/hooks/use-cart';

export default function CheckoutSuccessPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const reference = searchParams.get('reference');
  const { clearCart } = useCart();
  const [status, setStatus] = useState<
    'verifying' | 'success' | 'pending' | 'failed'
  >('verifying');
  const [orderNumber, setOrderNumber] = useState<string | null>(null);

  useEffect(() => {
    // Verify payment status FIRST, then decide whether to clear cart
    const verifyPayment = async () => {
      if (!reference) {
        // No reference - redirect back to checkout
        router.push('/checkout');
        return;
      }

      try {
        // Check payment status via API
        const response = await fetch(
          `/api/payments/verify?reference=${reference}`
        );
        const data = await response.json();

        if (data.success && data.status === 'success') {
          // Payment successful - clear cart and show success
          clearCart();
          setStatus('success');
          setOrderNumber(
            data.orderNumber || reference.slice(0, 8).toUpperCase()
          );
        } else if (data.status === 'pending') {
          // Payment pending - show pending state (don't clear cart yet, webhook will handle)
          setStatus('pending');
          setOrderNumber(
            data.orderNumber || reference.slice(0, 8).toUpperCase()
          );
        } else if (data.status === 'failed' || data.status === 'cancelled') {
          // Payment failed - redirect back to checkout so user can try again
          setStatus('failed');
          // After showing the failed message briefly, redirect to checkout
          setTimeout(() => {
            router.push('/checkout');
          }, 3000);
        } else {
          // Unknown status - show pending
          setStatus('pending');
          setOrderNumber(reference.slice(0, 8).toUpperCase());
        }
      } catch (error) {
        console.error('Failed to verify payment:', error);
        // Verification failed - show pending, webhook will update order status
        setStatus('pending');
        setOrderNumber(reference.slice(0, 8).toUpperCase());
      }
    };

    verifyPayment();
  }, [reference, clearCart, router]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center"
      >
        {status === 'verifying' && (
          <>
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Loader2 className="w-8 h-8 text-gray-500 animate-spin" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">
              Verifying Payment...
            </h1>
            <p className="text-gray-600">
              Please wait while we confirm your payment.
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: 0.2 }}
              className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6"
            >
              <CheckCircle className="w-10 h-10 text-green-600" />
            </motion.div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Order Confirmed! 🎉
            </h1>
            <p className="text-gray-600 mb-4">
              Thank you for your purchase. Your order has been confirmed and is
              being processed.
            </p>
            {orderNumber && (
              <div className="bg-gray-50 rounded-xl p-4 mb-6">
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                  Order Number
                </p>
                <p className="text-xl font-mono font-bold text-gray-900">
                  #{orderNumber}
                </p>
              </div>
            )}
            <div className="flex items-start gap-3 text-left bg-blue-50 rounded-xl p-4 mb-6">
              <Package className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-blue-700">
                You&apos;ll receive an email confirmation shortly with tracking
                details.
              </p>
            </div>
          </>
        )}

        {status === 'pending' && (
          <>
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Loader2 className="w-8 h-8 text-amber-600 animate-spin" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">
              Payment Processing...
            </h1>
            <p className="text-gray-600 mb-4">
              Your payment is being processed. This usually takes a few seconds.
            </p>
            {orderNumber && (
              <div className="bg-gray-50 rounded-xl p-4 mb-6">
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                  Order Reference
                </p>
                <p className="text-lg font-mono font-bold text-gray-900">
                  #{orderNumber}
                </p>
              </div>
            )}
            <p className="text-sm text-gray-500">
              You&apos;ll receive an email confirmation once the payment is
              complete.
            </p>
          </>
        )}

        {status === 'failed' && (
          <>
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">
              Payment Failed
            </h1>
            <p className="text-gray-600 mb-4">
              Your payment was not successful. Redirecting you back to
              checkout...
            </p>
            <p className="text-sm text-gray-500">
              You can try a different payment method.
            </p>
          </>
        )}

        {(status === 'success' || status === 'pending') && (
          <div className="flex flex-col gap-3 mt-6">
            <Link
              href="/"
              className="w-full bg-gray-900 text-white py-3 px-6 rounded-xl font-bold hover:bg-gray-800 transition-colors"
            >
              Continue Shopping
            </Link>
            <Link
              href="/account/orders"
              className="w-full bg-gray-100 text-gray-700 py-3 px-6 rounded-xl font-bold hover:bg-gray-200 transition-colors"
            >
              View My Orders
            </Link>
          </div>
        )}

        {status === 'failed' && (
          <div className="flex flex-col gap-3 mt-6">
            <Link
              href="/checkout"
              className="w-full bg-red-600 text-white py-3 px-6 rounded-xl font-bold hover:bg-red-700 transition-colors"
            >
              Return to Checkout
            </Link>
          </div>
        )}
      </motion.div>
    </div>
  );
}
