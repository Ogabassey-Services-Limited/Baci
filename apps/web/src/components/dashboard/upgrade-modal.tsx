'use client';

/**
 * Upgrade Modal Component
 *
 * Shows when users try to access premium features without the right plan.
 * Can be triggered from anywhere using the useUpgradeModal hook.
 */

import {
  BarChart,
  Check,
  Mail,
  MessageSquare,
  Shield,
  Sparkles,
  TrendingUp,
  X,
} from 'lucide-react';
import { createContext, type ReactNode, useContext, useState } from 'react';
import {
  FEATURE_METADATA,
  type FeatureKey,
  type PlanTier,
} from '@/lib/feature-flags';

// ============================================================================
// TYPES
// ============================================================================

interface UpgradeModalContextType {
  isOpen: boolean;
  feature: FeatureKey | null;
  targetPlan: PlanTier;
  open: (feature: FeatureKey) => void;
  close: () => void;
}

// ============================================================================
// CONTEXT
// ============================================================================

const UpgradeModalContext = createContext<UpgradeModalContextType | undefined>(
  undefined
);

export const useUpgradeModal = () => {
  const context = useContext(UpgradeModalContext);
  if (!context) {
    throw new Error(
      'useUpgradeModal must be used within an UpgradeModalProvider'
    );
  }
  return context;
};

// ============================================================================
// PROVIDER
// ============================================================================

export function UpgradeModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [feature, setFeature] = useState<FeatureKey | null>(null);
  const [targetPlan, setTargetPlan] = useState<PlanTier>('pro');

  const open = (feat: FeatureKey) => {
    setFeature(feat);
    const metadata = FEATURE_METADATA[feat];
    setTargetPlan(metadata?.minPlan ?? 'pro');
    setIsOpen(true);
  };

  const close = () => {
    setIsOpen(false);
    // Delay clearing feature so animation can complete
    setTimeout(() => setFeature(null), 300);
  };

  return (
    <UpgradeModalContext.Provider
      value={{ isOpen, feature, targetPlan, open, close }}
    >
      {children}
      <UpgradeModal />
    </UpgradeModalContext.Provider>
  );
}

// ============================================================================
// MODAL COMPONENT
// ============================================================================

const PLAN_PRICING: Record<PlanTier, { price: number; period: string }> = {
  free: { price: 0, period: 'Forever' },
  starter: { price: 9, period: '/month' },
  pro: { price: 29, period: '/month' },
  business: { price: 79, period: '/month' },
  enterprise: { price: 199, period: '/month' },
};

const FEATURE_ICONS: Record<string, typeof Shield> = {
  handshake: MessageSquare,
  'shield-check': Shield,
  'trending-up': TrendingUp,
  mail: Mail,
  'bar-chart': BarChart,
  sparkles: Sparkles,
};

function UpgradeModal() {
  const { isOpen, feature, targetPlan, close } = useUpgradeModal();

  if (!isOpen || !feature) return null;

  const metadata = FEATURE_METADATA[feature];
  const pricing = PLAN_PRICING[targetPlan];
  const IconComponent = FEATURE_ICONS[metadata?.icon ?? 'sparkles'] ?? Sparkles;

  // Get all features included in the target plan
  const planFeatures = Object.entries(FEATURE_METADATA)
    .filter(([_, meta]) => {
      const planOrder: PlanTier[] = [
        'free',
        'starter',
        'pro',
        'business',
        'enterprise',
      ];
      const featurePlanIndex = planOrder.indexOf(meta.minPlan);
      const targetPlanIndex = planOrder.indexOf(targetPlan);
      return featurePlanIndex <= targetPlanIndex;
    })
    .slice(0, 6);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
      {/* Backdrop */}
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-default border-none"
        onClick={close}
        aria-label="Close modal"
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-300">
        {/* Header with gradient */}
        <div className="bg-gradient-to-br from-purple-600 via-indigo-600 to-blue-600 px-6 py-8 text-white relative overflow-hidden">
          {/* Background pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-white/20 -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full bg-white/20 translate-y-1/2 -translate-x-1/2" />
          </div>

          {/* Close button */}
          <button
            type="button"
            onClick={close}
            className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors"
            aria-label="Close upgrade modal"
          >
            <X size={24} />
          </button>

          {/* Icon */}
          <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center mb-4">
            <IconComponent size={32} className="text-white" />
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold mb-2">
            Unlock {metadata?.name ?? 'Premium Feature'}
          </h2>
          <p className="text-white/80">
            {metadata?.description ?? 'Get access to advanced features'}
          </p>
        </div>

        {/* Body */}
        <div className="p-6">
          {/* Pricing */}
          <div className="flex items-baseline gap-2 mb-6">
            <span className="text-4xl font-bold text-gray-900">
              ${pricing.price}
            </span>
            <span className="text-gray-500">{pricing.period}</span>
            <span className="ml-2 bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded-full">
              {targetPlan.charAt(0).toUpperCase() + targetPlan.slice(1)} Plan
            </span>
          </div>

          {/* Features list */}
          <div className="space-y-3 mb-6">
            <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">
              What's included:
            </p>
            {planFeatures.map(([key, meta]) => (
              <div key={key} className="flex items-center gap-3">
                <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Check size={12} className="text-green-600" />
                </div>
                <span className="text-gray-700">{meta.name}</span>
                {key === feature && (
                  <span className="bg-purple-100 text-purple-700 text-xs font-medium px-2 py-0.5 rounded">
                    This feature
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* CTA buttons */}
          <div className="space-y-3">
            <button
              type="button"
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold py-3 px-6 rounded-xl hover:opacity-90 transition-opacity shadow-lg shadow-purple-200"
              onClick={() => {
                // TODO: Redirect to pricing page or Stripe checkout
                window.location.href = '/dashboard/settings?tab=billing';
              }}
            >
              Upgrade to{' '}
              {targetPlan.charAt(0).toUpperCase() + targetPlan.slice(1)}
            </button>
            <button
              type="button"
              onClick={close}
              className="w-full text-gray-500 font-medium py-2 hover:text-gray-700 transition-colors"
            >
              Maybe later
            </button>
          </div>

          {/* Trust badge */}
          <p className="text-center text-xs text-gray-400 mt-4">
            Cancel anytime • 14-day money back guarantee
          </p>
        </div>
      </div>
    </div>
  );
}

export default UpgradeModal;
