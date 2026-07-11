import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { REPAIR_WIZARD_STEPS } from './repair-booking-wizard-constants';

interface RepairWizardProgressBarProps {
  currentStep: number;
}

/**
 * Step labels + animated progress fill for the repair booking wizard.
 */
export function RepairWizardProgressBar({
  currentStep,
}: RepairWizardProgressBarProps) {
  return (
    <div className="mb-8">
      <div className="mb-2 flex justify-between">
        {REPAIR_WIZARD_STEPS.map((step, index) => (
          <div
            className={cn(
              'text-sm font-medium transition-colors',
              index <= currentStep ? '' : 'text-muted-foreground'
            )}
            key={step.id}
            style={
              index <= currentStep
                ? { color: 'var(--theme-primary, #dc2626)' }
                : undefined
            }
          >
            {step.title}
          </div>
        ))}
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-secondary">
        <motion.div
          animate={{
            width: `${((currentStep + 1) / REPAIR_WIZARD_STEPS.length) * 100}%`,
          }}
          className="h-full"
          initial={{ width: 0 }}
          style={{ backgroundColor: 'var(--theme-primary, #dc2626)' }}
          transition={{ duration: 0.3 }}
        />
      </div>
    </div>
  );
}
