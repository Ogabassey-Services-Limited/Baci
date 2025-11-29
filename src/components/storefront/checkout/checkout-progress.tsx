'use client';

/**
 * Checkout Progress Indicator
 *
 * 2025 Best Practices Applied:
 * - Use verbs instead of step numbers ("Shipping →" not "Step 1")
 * - Clickable labels for navigation
 * - Visual progress with clear current state
 * - Mobile-friendly compact design
 */

import { Check, Truck, CreditCard, ClipboardCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CheckoutStep, CheckoutProgressProps } from './types';

interface StepConfig {
  id: CheckoutStep;
  label: string;
  shortLabel: string;
  icon: typeof Truck;
}

const STEPS: StepConfig[] = [
  { id: 'shipping', label: 'Shipping', shortLabel: 'Ship', icon: Truck },
  { id: 'payment', label: 'Payment', shortLabel: 'Pay', icon: CreditCard },
  { id: 'review', label: 'Review', shortLabel: 'Done', icon: ClipboardCheck },
];

const STEP_ORDER: Record<CheckoutStep, number> = {
  shipping: 0,
  payment: 1,
  review: 2,
};

export function CheckoutProgress({
  currentStep,
  onStepClick,
  className,
}: CheckoutProgressProps) {
  const currentStepIndex = STEP_ORDER[currentStep];

  return (
    <nav aria-label="Checkout progress" className={cn('w-full', className)}>
      <ol className="flex items-center justify-between">
        {STEPS.map((step, index) => {
          const isCompleted = index < currentStepIndex;
          const isCurrent = index === currentStepIndex;
          const isClickable = isCompleted && onStepClick;

          return (
            <li
              key={step.id}
              className={cn(
                'flex-1 relative',
                index < STEPS.length - 1 && 'pr-4 sm:pr-8'
              )}
            >
              {/* Connector Line */}
              {index < STEPS.length - 1 && (
                <div
                  className={cn(
                    'absolute top-5 left-1/2 w-full h-0.5',
                    isCompleted ? 'bg-primary' : 'bg-border'
                  )}
                  aria-hidden="true"
                />
              )}

              {/* Step Button/Indicator */}
              <button
                type="button"
                onClick={() => isClickable && onStepClick(step.id)}
                disabled={!isClickable}
                className={cn(
                  'relative flex flex-col items-center group',
                  isClickable && 'cursor-pointer',
                  !isClickable && 'cursor-default'
                )}
                aria-current={isCurrent ? 'step' : undefined}
              >
                {/* Circle Indicator */}
                <span
                  className={cn(
                    'flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all z-10 bg-background',
                    isCompleted && 'bg-primary border-primary text-primary-foreground',
                    isCurrent && 'border-primary text-primary',
                    !isCompleted && !isCurrent && 'border-muted-foreground/30 text-muted-foreground',
                    isClickable && 'group-hover:ring-2 group-hover:ring-primary/20'
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <step.icon className="h-5 w-5" />
                  )}
                </span>

                {/* Label */}
                <span
                  className={cn(
                    'mt-2 text-sm font-medium transition-colors',
                    isCurrent && 'text-primary',
                    isCompleted && 'text-primary',
                    !isCompleted && !isCurrent && 'text-muted-foreground'
                  )}
                >
                  {/* Full label on desktop, short on mobile */}
                  <span className="hidden sm:inline">{step.label}</span>
                  <span className="sm:hidden">{step.shortLabel}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * Compact Progress Bar (alternative for tight spaces)
 */
export function CheckoutProgressBar({
  currentStep,
  className,
}: Omit<CheckoutProgressProps, 'onStepClick'>) {
  const currentStepIndex = STEP_ORDER[currentStep];
  const progress = ((currentStepIndex + 1) / STEPS.length) * 100;

  return (
    <div className={cn('space-y-2', className)}>
      {/* Progress Bar */}
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Step Label */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          Step {currentStepIndex + 1} of {STEPS.length}
        </span>
        <span className="font-medium">
          {STEPS[currentStepIndex].label}
        </span>
      </div>
    </div>
  );
}

export default CheckoutProgress;
