'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, Eye, Clock, TrendingUp, Flame, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

interface SocialProofProps {
  productId: string;
  stock?: number;
  lowStockThreshold?: number;
  recentSalesCount?: number;
  showViewers?: boolean;
  showRecentPurchases?: boolean;
  showLowStock?: boolean;
  showSalesCount?: boolean;
  className?: string;
}

interface RecentPurchase {
  id: string;
  city: string;
  timeAgo: string;
  productName?: string;
}

// =============================================================================
// LOW STOCK BADGE
// =============================================================================

export function LowStockBadge({
  stock,
  threshold = 5,
  className,
}: {
  stock: number;
  threshold?: number;
  className?: string;
}) {
  if (stock <= 0) {
    return (
      <div className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
        "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
        className
      )}>
        <AlertTriangle className="h-3 w-3" />
        Out of Stock
      </div>
    );
  }

  if (stock <= threshold) {
    return (
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
          "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
          className
        )}
      >
        <Flame className="h-3 w-3 animate-pulse" />
        Only {stock} left!
      </motion.div>
    );
  }

  return null;
}

// =============================================================================
// VIEWER COUNT
// =============================================================================

export function ViewerCount({
  productId,
  initialCount,
  className,
}: {
  productId: string;
  initialCount?: number;
  className?: string;
}) {
  const [viewers, setViewers] = useState(initialCount ?? 0);

  useEffect(() => {
    // Simulate real-time viewer count with realistic fluctuation
    // In production, this would connect to a real-time service
    const baseCount = Math.floor(Math.random() * 8) + 2; // 2-10 base
    setViewers(baseCount);

    const interval = setInterval(() => {
      setViewers(prev => {
        const change = Math.random() > 0.5 ? 1 : -1;
        const newCount = Math.max(1, Math.min(15, prev + change));
        return newCount;
      });
    }, 5000 + Math.random() * 10000); // Random interval 5-15s

    return () => clearInterval(interval);
  }, [productId]);

  if (viewers < 2) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "inline-flex items-center gap-1.5 text-xs text-muted-foreground",
        className
      )}
    >
      <Eye className="h-3.5 w-3.5" />
      <span>
        <strong className="text-foreground">{viewers}</strong> people viewing
      </span>
    </motion.div>
  );
}

// =============================================================================
// RECENT SALES COUNT
// =============================================================================

export function RecentSalesCount({
  count,
  period = '24 hours',
  className,
}: {
  count: number;
  period?: string;
  className?: string;
}) {
  if (count < 3) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={cn(
        "inline-flex items-center gap-1.5 text-xs text-muted-foreground",
        className
      )}
    >
      <TrendingUp className="h-3.5 w-3.5 text-green-500" />
      <span>
        <strong className="text-foreground">{count}</strong> sold in last {period}
      </span>
    </motion.div>
  );
}

// =============================================================================
// RECENT PURCHASE TOAST
// =============================================================================

export function RecentPurchaseToast({
  purchases,
  autoRotate = true,
  interval = 8000,
  className,
}: {
  purchases: RecentPurchase[];
  autoRotate?: boolean;
  interval?: number;
  className?: string;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!autoRotate || purchases.length === 0) return;

    // Initial delay before first toast
    const initialDelay = setTimeout(() => {
      setVisible(true);
    }, 3000);

    const rotateInterval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setCurrentIndex(prev => (prev + 1) % purchases.length);
        setVisible(true);
      }, 500);
    }, interval);

    return () => {
      clearTimeout(initialDelay);
      clearInterval(rotateInterval);
    };
  }, [autoRotate, interval, purchases.length]);

  if (purchases.length === 0) return null;

  const current = purchases[currentIndex];

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, x: -100, y: 0 }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          exit={{ opacity: 0, x: -100 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          className={cn(
            "fixed bottom-4 left-4 z-50 max-w-xs",
            "bg-background/95 backdrop-blur-sm border rounded-lg shadow-lg p-3",
            className
          )}
        >
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-full bg-green-100 dark:bg-green-900/30">
              <ShoppingBag className="h-4 w-4 text-green-600 dark:text-green-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">
                Someone in {current.city}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                purchased {current.productName || 'this item'}
              </p>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <Clock className="h-3 w-3" />
                {current.timeAgo}
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// =============================================================================
// URGENCY BADGE
// =============================================================================

export function UrgencyBadge({
  type,
  value,
  className,
}: {
  type: 'sale_ending' | 'limited_offer' | 'high_demand';
  value?: string;
  className?: string;
}) {
  const configs = {
    sale_ending: {
      icon: Clock,
      text: value ? `Sale ends in ${value}` : 'Sale ending soon',
      colors: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    },
    limited_offer: {
      icon: Flame,
      text: value || 'Limited time offer',
      colors: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    },
    high_demand: {
      icon: TrendingUp,
      text: value || 'High demand',
      colors: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    },
  };

  const config = configs[type];
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ scale: 0.95 }}
      animate={{ scale: 1 }}
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
        config.colors,
        className
      )}
    >
      <Icon className="h-3 w-3" />
      {config.text}
    </motion.div>
  );
}

// =============================================================================
// COMBINED SOCIAL PROOF WIDGET
// =============================================================================

export function SocialProofWidget({
  productId,
  stock,
  lowStockThreshold = 5,
  recentSalesCount,
  showViewers = true,
  showRecentPurchases = true,
  showLowStock = true,
  showSalesCount = true,
  className,
}: SocialProofProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      {showLowStock && stock !== undefined && (
        <LowStockBadge stock={stock} threshold={lowStockThreshold} />
      )}

      {showViewers && (
        <ViewerCount productId={productId} />
      )}

      {showSalesCount && recentSalesCount !== undefined && recentSalesCount > 0 && (
        <RecentSalesCount count={recentSalesCount} />
      )}
    </div>
  );
}

// =============================================================================
// HOOK FOR FETCHING SOCIAL PROOF DATA
// =============================================================================

interface SocialProofData {
  recentSales: number;
  recentPurchases: RecentPurchase[];
  trending: boolean;
}

export function useSocialProof(productId: string, merchantId: string) {
  const [data, setData] = useState<SocialProofData>({
    recentSales: 0,
    recentPurchases: [],
    trending: false,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSocialProof() {
      try {
        const response = await fetch(
          `/api/storefront/social-proof?productId=${productId}&merchantId=${merchantId}`
        );
        if (response.ok) {
          const result = await response.json();
          setData(result);
        }
      } catch (error) {
        console.warn('Failed to fetch social proof:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchSocialProof();
  }, [productId, merchantId]);

  return { data, loading };
}

export default SocialProofWidget;
