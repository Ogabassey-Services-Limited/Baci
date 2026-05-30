'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CheckoutProgressProps {
  currentStep: number;
  steps?: { label: string; description?: string }[];
}

const defaultSteps = [
  { label: 'Cart', description: 'Review items' },
  { label: 'Information', description: 'Contact & shipping' },
  { label: 'Payment', description: 'Complete order' },
];

export function CheckoutProgress({
  currentStep,
  steps = defaultSteps,
}: CheckoutProgressProps) {
  return (
    <div className="w-full">
      {/* Desktop Progress */}
      <div className="hidden sm:block">
        <div className="relative">
          {/* Progress Line */}
          <div className="absolute left-0 top-4 h-0.5 w-full bg-muted" />
          <div
            className="absolute left-0 top-4 h-0.5 bg-primary transition-all duration-500"
            style={{
              width: `${((currentStep - 1) / (steps.length - 1)) * 100}%`,
            }}
          />

          {/* Steps */}
          <div className="relative flex justify-between">
            {steps.map((step, index) => {
              const stepNumber = index + 1;
              const isCompleted = stepNumber < currentStep;
              const isCurrent = stepNumber === currentStep;

              return (
                <div
                  key={step.label}
                  className={cn(
                    'flex flex-col items-center',
                    index === 0 && 'items-start',
                    index === steps.length - 1 && 'items-end'
                  )}
                >
                  <div
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-full border-2 bg-background transition-colors',
                      isCompleted &&
                        'border-primary bg-primary text-primary-foreground',
                      isCurrent && 'border-primary',
                      !isCompleted && !isCurrent && 'border-muted'
                    )}
                  >
                    {isCompleted ? (
                      <Check className="size-4" />
                    ) : (
                      <span
                        className={cn(
                          'text-sm font-medium',
                          isCurrent && 'text-primary',
                          !isCurrent && 'text-muted-foreground'
                        )}
                      >
                        {stepNumber}
                      </span>
                    )}
                  </div>
                  <div
                    className={cn(
                      'mt-2 text-center',
                      index === 0 && 'text-left',
                      index === steps.length - 1 && 'text-right'
                    )}
                  >
                    <p
                      className={cn(
                        'text-sm font-medium',
                        (isCompleted || isCurrent) && 'text-foreground',
                        !isCompleted && !isCurrent && 'text-muted-foreground'
                      )}
                    >
                      {step.label}
                    </p>
                    {step.description && (
                      <p className="text-xs text-muted-foreground">
                        {step.description}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Mobile Progress */}
      <div className="sm:hidden">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">
            Step {currentStep} of {steps.length}
          </span>
          <span className="text-sm text-muted-foreground">
            {steps[currentStep - 1]?.label}
          </span>
        </div>
        <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-500 rounded-full"
            style={{
              width: `${(currentStep / steps.length) * 100}%`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
