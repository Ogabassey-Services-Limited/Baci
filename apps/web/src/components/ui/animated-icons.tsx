'use client';

/**
 * Animated Icons using Framer Motion
 *
 * Provides animated icon wrappers with micro-interactions for 2025 UI best practices.
 * All animations respect prefers-reduced-motion via Framer Motion's built-in support.
 */

import { AnimatePresence, motion, type Variants } from 'framer-motion';
import { forwardRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

// Animation variants for different icon types
const spinVariants: Variants = {
  animate: {
    rotate: 360,
    transition: {
      duration: 1,
      repeat: Number.POSITIVE_INFINITY,
      ease: 'linear',
    },
  },
};

const pulseVariants: Variants = {
  animate: {
    scale: [1, 1.1, 1],
    transition: {
      duration: 1.5,
      repeat: Number.POSITIVE_INFINITY,
      ease: 'easeInOut',
    },
  },
};

const bounceVariants: Variants = {
  animate: {
    y: [0, -4, 0],
    transition: {
      duration: 0.6,
      repeat: Number.POSITIVE_INFINITY,
      ease: 'easeInOut',
    },
  },
};

const shakeVariants: Variants = {
  animate: {
    x: [0, -2, 2, -2, 0],
    transition: {
      duration: 0.4,
      repeat: Number.POSITIVE_INFINITY,
      repeatDelay: 2,
    },
  },
};

const hoverScaleVariants: Variants = {
  initial: { scale: 1 },
  hover: { scale: 1.15, transition: { duration: 0.2, ease: 'easeOut' } },
  tap: { scale: 0.95 },
};

const hoverRotateVariants: Variants = {
  initial: { rotate: 0 },
  hover: { rotate: 12, transition: { duration: 0.2, ease: 'easeOut' } },
  tap: { rotate: -12 },
};

// Reserved for future animated checkmark component
const _checkmarkVariants: Variants = {
  initial: { pathLength: 0, opacity: 0 },
  animate: {
    pathLength: 1,
    opacity: 1,
    transition: { duration: 0.4, ease: 'easeOut' },
  },
};

interface AnimatedIconWrapperProps {
  children: ReactNode;
  animation?: 'spin' | 'pulse' | 'bounce' | 'shake' | 'none';
  hoverEffect?: 'scale' | 'rotate' | 'none';
  className?: string;
  onClick?: () => void;
  ariaLabel?: string;
}

/**
 * Animated Icon Wrapper
 * Wraps any icon with animation effects
 */
export const AnimatedIcon = forwardRef<
  HTMLDivElement,
  AnimatedIconWrapperProps
>(
  (
    {
      children,
      animation = 'none',
      hoverEffect = 'scale',
      className,
      onClick,
      ariaLabel,
    },
    ref
  ) => {
    const getAnimationVariants = () => {
      switch (animation) {
        case 'spin':
          return spinVariants;
        case 'pulse':
          return pulseVariants;
        case 'bounce':
          return bounceVariants;
        case 'shake':
          return shakeVariants;
        default:
          return {};
      }
    };

    const getHoverVariants = () => {
      switch (hoverEffect) {
        case 'scale':
          return hoverScaleVariants;
        case 'rotate':
          return hoverRotateVariants;
        default:
          return {};
      }
    };

    const combinedVariants = {
      ...getAnimationVariants(),
      ...getHoverVariants(),
    };

    return (
      <motion.div
        ref={ref}
        className={cn('inline-flex items-center justify-center', className)}
        variants={combinedVariants}
        initial="initial"
        animate={animation !== 'none' ? 'animate' : 'initial'}
        whileHover={hoverEffect !== 'none' ? 'hover' : undefined}
        whileTap={hoverEffect !== 'none' ? 'tap' : undefined}
        onClick={onClick}
        aria-label={ariaLabel}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
      >
        {children}
      </motion.div>
    );
  }
);
AnimatedIcon.displayName = 'AnimatedIcon';

/**
 * Loading Spinner with smooth animation
 */
export function LoadingSpinner({
  size = 24,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={cn('inline-flex', className)}
      animate={{ rotate: 360 }}
      transition={{
        duration: 1,
        repeat: Number.POSITIVE_INFINITY,
        ease: 'linear',
      }}
    >
      <svg
        aria-hidden="true"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
      </svg>
    </motion.div>
  );
}

/**
 * Success Checkmark with draw animation
 */
export function SuccessCheck({
  size = 24,
  className,
  delay = 0,
}: {
  size?: number;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={cn('text-green-500', className)}
      initial="initial"
      animate="animate"
    >
      <motion.circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="2"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.4, delay, ease: 'easeOut' }}
      />
      <motion.path
        d="M9 12l2 2 4-4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.3, delay: delay + 0.3, ease: 'easeOut' }}
      />
    </motion.svg>
  );
}

/**
 * Notification Bell with shake animation on new notification
 */
export function NotificationBell({
  hasNotification = false,
  size = 24,
  className,
}: {
  hasNotification?: boolean;
  size?: number;
  className?: string;
}) {
  return (
    <div className="relative">
      <motion.div
        className={className}
        animate={hasNotification ? { rotate: [0, -10, 10, -10, 10, 0] } : {}}
        transition={{ duration: 0.5 }}
      >
        <svg
          aria-hidden="true"
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      </motion.div>
      <AnimatePresence>
        {hasNotification && (
          <motion.span
            className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-red-500"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Heart icon with like animation
 */
export function HeartIcon({
  liked = false,
  size = 24,
  className,
  onToggle,
}: {
  liked?: boolean;
  size?: number;
  className?: string;
  onToggle?: () => void;
}) {
  return (
    <motion.button
      className={cn(
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm',
        className
      )}
      whileTap={{ scale: 0.85 }}
      onClick={onToggle}
      aria-label={liked ? 'Unlike' : 'Like'}
      type="button"
    >
      <motion.svg
        aria-hidden="true"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill={liked ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cn(liked ? 'text-red-500' : 'text-muted-foreground')}
        animate={liked ? { scale: [1, 1.2, 1] } : { scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
      </motion.svg>
    </motion.button>
  );
}

/**
 * Cart icon with item count badge that animates on change
 */
export function CartIcon({
  count = 0,
  size = 24,
  className,
}: {
  count?: number;
  size?: number;
  className?: string;
}) {
  return (
    <div className="relative">
      <motion.svg
        aria-hidden="true"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        animate={count > 0 ? { y: [0, -2, 0] } : {}}
        transition={{ duration: 0.3 }}
      >
        <circle cx="8" cy="21" r="1" />
        <circle cx="19" cy="21" r="1" />
        <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
      </motion.svg>
      <AnimatePresence mode="wait">
        {count > 0 && (
          <motion.span
            key={count}
            className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          >
            {count > 99 ? '99+' : count}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Animated Plus/Minus for quantity controls
 */
export function QuantityButton({
  type,
  onClick,
  disabled = false,
  className,
}: {
  type: 'plus' | 'minus';
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <motion.button
      type="button"
      className={cn(
        'flex h-8 w-8 items-center justify-center rounded-md border border-input bg-background text-foreground',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        'disabled:pointer-events-none disabled:opacity-50',
        className
      )}
      onClick={onClick}
      disabled={disabled}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      aria-label={type === 'plus' ? 'Increase quantity' : 'Decrease quantity'}
    >
      <motion.svg
        aria-hidden="true"
        width={16}
        height={16}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={false}
        animate={{ rotate: type === 'plus' ? 0 : 0 }}
      >
        {type === 'plus' ? (
          <>
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </>
        ) : (
          <line x1="5" y1="12" x2="19" y2="12" />
        )}
      </motion.svg>
    </motion.button>
  );
}

/**
 * Animated Menu/Close toggle (hamburger menu)
 */
export function MenuToggle({
  isOpen = false,
  onClick,
  size = 24,
  className,
}: {
  isOpen?: boolean;
  onClick: () => void;
  size?: number;
  className?: string;
}) {
  return (
    <motion.button
      type="button"
      className={cn(
        'flex items-center justify-center',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md',
        className
      )}
      onClick={onClick}
      aria-label={isOpen ? 'Close menu' : 'Open menu'}
      aria-expanded={isOpen}
    >
      <svg
        aria-hidden="true"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <motion.line
          x1="3"
          y1="6"
          x2="21"
          y2="6"
          animate={isOpen ? { rotate: 45, y: 6 } : { rotate: 0, y: 0 }}
          transition={{ duration: 0.2 }}
          style={{ transformOrigin: 'center' }}
        />
        <motion.line
          x1="3"
          y1="12"
          x2="21"
          y2="12"
          animate={isOpen ? { opacity: 0, x: -10 } : { opacity: 1, x: 0 }}
          transition={{ duration: 0.2 }}
        />
        <motion.line
          x1="3"
          y1="18"
          x2="21"
          y2="18"
          animate={isOpen ? { rotate: -45, y: -6 } : { rotate: 0, y: 0 }}
          transition={{ duration: 0.2 }}
          style={{ transformOrigin: 'center' }}
        />
      </svg>
    </motion.button>
  );
}

/**
 * Animated chevron for accordions/expandable sections
 */
export function ChevronToggle({
  isExpanded = false,
  size = 20,
  className,
}: {
  isExpanded?: boolean;
  size?: number;
  className?: string;
}) {
  return (
    <motion.svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      animate={{ rotate: isExpanded ? 180 : 0 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
    >
      <polyline points="6 9 12 15 18 9" />
    </motion.svg>
  );
}
