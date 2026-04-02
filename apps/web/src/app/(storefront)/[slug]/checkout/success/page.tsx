'use client';

import { motion } from 'framer-motion';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Loader2,
  Mail,
  MapPin,
  Package,
  ShoppingBag,
  Star,
  Truck,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AdUnit } from '@/components/storefront/ogabassey/components/AdUnit';
import { useCart } from '@/hooks/use-cart';
import { useMerchantSafe } from '@/hooks/use-merchant';
import { BACI_GOOGLE_REVIEW_URL } from '@/lib/post-purchase-actions';
import { asRoute } from '@/lib/routes';

/**
 * 2025 Best Practice: Order Confirmation Page
 * - Clear status communication (Order Received vs Confirmed)
 * - Visual timeline/stepper showing order progress
 * - Receipt download info
 * - Mobile-first responsive design
 * - Micro-animations for engagement
 */

const orderSteps = [
  { id: 'received', label: 'Order Received', icon: CheckCircle2 },
  { id: 'processing', label: 'Processing', icon: Package },
  { id: 'shipped', label: 'Shipped', icon: Truck },
  { id: 'delivered', label: 'Delivered', icon: MapPin },
];

export default function CheckoutSuccessPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const reference = searchParams.get('reference');
  const { clearCart } = useCart();
  const merchantContext = useMerchantSafe();
  const basePath = merchantContext?.basePath || '';
  const storeName = merchantContext?.merchant?.business_name || 'Store';

  const getHref = (path: string) =>
    path.startsWith('http') ? path : `${basePath}${path}`;

  const [status, setStatus] = useState<
    'verifying' | 'success' | 'pending' | 'failed'
  >('verifying');
  const [orderNumber, setOrderNumber] = useState<string | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: React Compiler handles memoization
  useEffect(() => {
    const verifyPayment = async () => {
      if (!reference) {
        router.push(asRoute(getHref('/checkout')));
        return;
      }

      try {
        const response = await fetch(
          `/api/payments/verify?reference=${reference}`
        );
        const data = await response.json();

        if (data.success && data.status === 'success') {
          clearCart();
          setStatus('success');
          setOrderNumber(
            data.orderNumber || reference.slice(0, 8).toUpperCase()
          );
        } else if (data.status === 'pending') {
          setStatus('pending');
          setOrderNumber(
            data.orderNumber || reference.slice(0, 8).toUpperCase()
          );
        } else if (data.status === 'failed' || data.status === 'cancelled') {
          setStatus('failed');
          setTimeout(() => {
            router.push(asRoute(getHref('/checkout')));
          }, 4000);
        } else {
          setStatus('pending');
          setOrderNumber(reference.slice(0, 8).toUpperCase());
        }
      } catch (error) {
        console.error('Failed to verify payment:', error);
        setStatus('pending');
        setOrderNumber(reference.slice(0, 8).toUpperCase());
      }
    };

    verifyPayment();
  }, [reference, clearCart, router, basePath]);

  // Verifying State
  if (status === 'verifying') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="w-20 h-20 bg-white rounded-full shadow-lg flex items-center justify-center mx-auto mb-6">
            <Loader2 className="w-10 h-10 text-red-500 animate-spin" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Verifying Your Payment
          </h1>
          <p className="text-gray-500">
            Please wait while we confirm your transaction...
          </p>
        </motion.div>
      </div>
    );
  }

  // Failed State
  if (status === 'failed') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-red-50 to-white flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', delay: 0.1 }}
            className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6"
          >
            <AlertCircle className="w-10 h-10 text-red-600" />
          </motion.div>

          <h1 className="text-2xl font-bold text-gray-900 mb-3">
            Payment Unsuccessful
          </h1>
          <p className="text-gray-600 mb-6">
            We couldn&apos;t process your payment. Don&apos;t worry, your cart
            is still intact.
          </p>

          <div className="bg-red-50 border border-red-100 rounded-2xl p-4 mb-6">
            <p className="text-sm text-red-700">
              Redirecting you back to checkout in a few seconds...
            </p>
          </div>

          <Link
            href={asRoute(getHref('/checkout'))}
            className="w-full inline-flex items-center justify-center gap-2 bg-red-600 text-white py-4 px-6 rounded-2xl font-semibold hover:bg-red-700 transition-all"
          >
            Try Again
            <ArrowRight className="w-5 h-5" />
          </Link>
        </motion.div>
      </div>
    );
  }

  // Success & Pending States (main redesigned page)
  const isConfirmed = status === 'success';

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50/50 via-white to-gray-50">
      {/* Hero Section */}
      <div className="pt-12 pb-8 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-2xl mx-auto text-center"
        >
          {/* Animated Checkmark */}
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
            className="relative w-24 h-24 mx-auto mb-6"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-green-400 to-green-600 rounded-full opacity-20 animate-pulse" />
            <div className="absolute inset-2 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center shadow-lg">
              <CheckCircle2 className="w-12 h-12 text-white" />
            </div>
          </motion.div>

          {/* Title */}
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-3xl md:text-4xl font-bold text-gray-900 mb-3"
          >
            {isConfirmed ? 'Order Received!' : 'Order Being Processed'}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-lg text-gray-600 mb-2"
          >
            Thank you for shopping with {storeName}
          </motion.p>

          {orderNumber && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="inline-flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm border border-gray-100"
            >
              <span className="text-sm text-gray-500">Order</span>
              <span className="font-mono font-bold text-gray-900">
                #{orderNumber}
              </span>
            </motion.div>
          )}
        </motion.div>
      </div>

      {/* Main Content */}
      <div className="px-4 pb-12">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Order Progress Timeline */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6"
          >
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-6">
              Order Progress
            </h2>
            <div className="relative">
              {/* Progress Line */}
              <div className="absolute top-5 left-5 right-5 h-0.5 bg-gray-100 hidden md:block" />
              <div
                className="absolute top-5 left-5 h-0.5 bg-green-500 hidden md:block transition-all duration-500"
                style={{ width: isConfirmed ? 'calc(25% - 10px)' : '0%' }}
              />

              {/* Steps */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {orderSteps.map((step, index) => {
                  const isActive = index === 0;
                  const isCompleted = isConfirmed && index === 0;
                  const StepIcon = step.icon;

                  return (
                    <motion.div
                      key={step.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.6 + index * 0.1 }}
                      className="flex flex-col items-center text-center"
                    >
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 transition-all ${
                          isCompleted
                            ? 'bg-green-500 text-white'
                            : isActive
                              ? 'bg-green-100 text-green-600 ring-2 ring-green-500 ring-offset-2'
                              : 'bg-gray-100 text-gray-400'
                        }`}
                      >
                        <StepIcon className="w-5 h-5" />
                      </div>
                      <span
                        className={`text-xs font-medium ${
                          isActive ? 'text-green-600' : 'text-gray-500'
                        }`}
                      >
                        {step.label}
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </motion.div>

          {/* What Happens Next Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6"
          >
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
              What Happens Next?
            </h2>
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Mail className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">
                    Order Confirmation Email
                  </h3>
                  <p className="text-sm text-gray-600">
                    You&apos;ll receive an email with your order details and
                    tracking information once your order is confirmed.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Clock className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">
                    Order Processing
                  </h3>
                  <p className="text-sm text-gray-600">
                    Our team will verify your payment and prepare your order for
                    shipping. This usually takes 1-2 business days.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Truck className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">
                    Shipping Updates
                  </h3>
                  <p className="text-sm text-gray-600">
                    Once shipped, you&apos;ll receive SMS and email updates with
                    real-time tracking information.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Receipt Info Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl p-6 text-white"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-1">
                  Your Receipt & Invoice
                </h3>
                <p className="text-gray-300 text-sm mb-4">
                  Your invoice is available from your order details in your
                  account. Your receipt will appear there and in the documents
                  archive once the order has shipped.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Link
                    href={asRoute(getHref('/account/orders'))}
                    className="inline-flex items-center justify-center gap-2 bg-white text-gray-900 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-100 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    View Order Documents
                  </Link>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Action Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 }}
            className="flex flex-col sm:flex-row gap-4"
          >
            <Link
              href={asRoute(getHref('/'))}
              className="flex-1 inline-flex items-center justify-center gap-2 bg-red-600 text-white py-4 px-6 rounded-2xl font-semibold hover:bg-red-700 transition-all shadow-lg shadow-red-600/25"
            >
              <ShoppingBag className="w-5 h-5" />
              Continue Shopping
            </Link>
            <Link
              href={asRoute(getHref('/account/orders'))}
              className="flex-1 inline-flex items-center justify-center gap-2 bg-white text-gray-700 py-4 px-6 rounded-2xl font-semibold hover:bg-gray-50 transition-all border border-gray-200"
            >
              <Package className="w-5 h-5" />
              Track Order
            </Link>
            <a
              href={BACI_GOOGLE_REVIEW_URL}
              target="_blank"
              rel="noreferrer"
              className="flex-1 inline-flex items-center justify-center gap-2 bg-white text-gray-700 py-4 px-6 rounded-2xl font-semibold hover:bg-gray-50 transition-all border border-gray-200"
            >
              <Star className="w-5 h-5" />
              Leave a Google Review
            </a>
          </motion.div>

          {/* Ad Placement: Post-Purchase Cross-Sell */}
          <div className="pt-4">
            <AdUnit placementKey="ORDER_SUCCESS_BANNER" />
          </div>

          {/* Help Section */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="text-center text-sm text-gray-500"
          >
            Need help?{' '}
            <Link
              href={asRoute(getHref('/pages/contact'))}
              className="text-red-600 font-medium hover:underline"
            >
              Contact our support team
            </Link>
          </motion.p>
        </div>
      </div>
    </div>
  );
}
