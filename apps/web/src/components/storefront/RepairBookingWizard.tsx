'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import type { z } from 'zod';
import {
  calculateRepairShipping,
  createRepair,
  type ShippingCalculationResult,
} from '@/app/actions/repair';
import type { PlaceDetails } from '@/components/address-autocomplete';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import {
  type RepairBookingInput,
  repairBookingSchema,
} from '@/lib/validations/repair';
import { RepairBookingSuccess } from './repair-booking-wizard/RepairBookingSuccess';
import { RepairContactStep } from './repair-booking-wizard/RepairContactStep';
import { RepairDeviceStep } from './repair-booking-wizard/RepairDeviceStep';
import { RepairReviewStep } from './repair-booking-wizard/RepairReviewStep';
import { RepairWizardProgressBar } from './repair-booking-wizard/RepairWizardProgressBar';
import {
  buildRepairWizardDefaultValues,
  REPAIR_WIZARD_STEPS,
  type RepairBookingPreselection,
} from './repair-booking-wizard/repair-booking-wizard-constants';

export type { RepairBookingPreselection };

interface RepairBookingWizardProps {
  merchantId: string;
  merchantName: string;
  /** Device/quote preselected via `/[slug]/repair?device=&quote=`. */
  preselection?: RepairBookingPreselection;
}

export function RepairBookingWizard({
  merchantId,
  merchantName,
  preselection,
}: RepairBookingWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [ticketNumber, setTicketNumber] = useState<number | null>(null);
  const [shippingQuote, setShippingQuote] =
    useState<ShippingCalculationResult | null>(null);
  const [isCalculatingShipping, setIsCalculatingShipping] = useState(false);
  const [showCatalogConfirmation, setShowCatalogConfirmation] = useState(
    Boolean(preselection)
  );
  const { toast } = useToast();

  const form = useForm<
    z.input<typeof repairBookingSchema>,
    unknown,
    RepairBookingInput
  >({
    defaultValues: buildRepairWizardDefaultValues(preselection),
    mode: 'onTouched',
    resolver: zodResolver(repairBookingSchema),
  });

  const { control, trigger } = form;
  // useWatch instead of watch(): watch() returns interior-mutable values that
  // force React Compiler to skip memoizing this component.
  const formData = useWatch({ control });

  const handleChangeDevice = () => {
    setShowCatalogConfirmation(false);
    form.setValue('deviceId', undefined);
    form.setValue('quoteId', undefined);
    form.setValue('deviceType', 'Smartphone');
    form.setValue('deviceModel', '');
    form.setValue('issueDescription', '');
  };

  const nextStep = async () => {
    let fieldsToValidate: (keyof RepairBookingInput)[] = [];
    if (currentStep === 0) {
      fieldsToValidate = ['deviceType', 'deviceModel', 'issueDescription'];
    } else if (currentStep === 1) {
      fieldsToValidate = [
        'customerName',
        'customerEmail',
        'customerPhone',
        'preferredDate',
      ];
    }

    const isValid = await trigger(fieldsToValidate);
    if (isValid) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const prevStep = () => {
    setCurrentStep((prev) => prev - 1);
  };

  const handleAddressSelect = (place: PlaceDetails) => {
    // Update form value
    form.setValue('pickupAddress', place.formattedAddress);

    // Calculate shipping. Promise chain instead of try/finally: React Compiler
    // cannot lower try statements with a finalizer inside component closures.
    setIsCalculatingShipping(true);
    setShippingQuote(null);
    calculateRepairShipping(place)
      .then((result) => {
        setShippingQuote(result);
      })
      .catch((error: unknown) => {
        console.error(error);
      })
      .finally(() => {
        setIsCalculatingShipping(false);
      });
  };

  const onSubmit = (data: RepairBookingInput) => {
    setIsSubmitting(true);
    // Promise chain instead of try/finally: React Compiler cannot lower try
    // statements with a finalizer inside component closures.
    return createRepair(data, merchantId)
      .then((result) => {
        if (result.success) {
          setTicketNumber(result.ticketNumber);
          setIsSuccess(true);
          toast({
            description:
              'We have received your repair request. We will contact you shortly.',
            title: 'Request Submitted',
          });
        } else {
          toast({
            description: result.error,
            title: 'Submission Failed',
            variant: 'destructive',
          });
        }
      })
      .catch(() => {
        toast({
          description: 'Something went wrong. Please try again.',
          title: 'Error',
          variant: 'destructive',
        });
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  if (isSuccess) {
    return (
      <motion.div
        animate={{ opacity: 1, scale: 1 }}
        initial={{ opacity: 0, scale: 0.95 }}
      >
        <RepairBookingSuccess
          merchantName={merchantName}
          ticketNumber={ticketNumber}
        />
      </motion.div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <RepairWizardProgressBar currentStep={currentStep} />

      {/* biome-ignore lint/suspicious/noExplicitAny: Workaround for react-hook-form/zod generic mismatch */}
      <Form {...(form as any)}>
        <form className="space-y-8" onSubmit={form.handleSubmit(onSubmit)}>
          <AnimatePresence mode="wait">
            {currentStep === 0 && (
              <motion.div
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                initial={{ opacity: 0, x: 20 }}
                key="step-0"
                transition={{ duration: 0.3 }}
              >
                <RepairDeviceStep
                  control={control}
                  onChangeDevice={handleChangeDevice}
                  preselection={preselection}
                  showConfirmation={showCatalogConfirmation}
                />
              </motion.div>
            )}

            {currentStep === 1 && (
              <motion.div
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                initial={{ opacity: 0, x: 20 }}
                key="step-1"
                transition={{ duration: 0.3 }}
              >
                <RepairContactStep
                  control={control}
                  isCalculatingShipping={isCalculatingShipping}
                  onAddressSelect={handleAddressSelect}
                  serviceType={formData.serviceType}
                  shippingQuote={shippingQuote}
                />
              </motion.div>
            )}

            {currentStep === 2 && (
              <motion.div
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                initial={{ opacity: 0, x: 20 }}
                key="step-2"
                transition={{ duration: 0.3 }}
              >
                <RepairReviewStep
                  formData={formData}
                  shippingQuote={shippingQuote}
                />
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex justify-between border-t pt-6">
            <Button
              className={currentStep === 0 ? 'invisible' : ''}
              disabled={currentStep === 0 || isSubmitting}
              onClick={prevStep}
              type="button"
              variant="outline"
            >
              <ChevronLeft className="mr-2 size-4" /> Back
            </Button>

            {currentStep < REPAIR_WIZARD_STEPS.length - 1 ? (
              <button
                className="inline-flex items-center rounded-md px-6 py-2.5 font-medium text-white transition-colors"
                onClick={nextStep}
                style={{ backgroundColor: 'var(--theme-primary, #dc2626)' }}
                type="button"
              >
                Next <ChevronRight className="ml-2 size-4" />
              </button>
            ) : (
              <button
                className="inline-flex items-center rounded-md px-6 py-2.5 font-medium text-white transition-colors disabled:opacity-50"
                disabled={isSubmitting}
                style={{ backgroundColor: 'var(--theme-primary, #dc2626)' }}
                type="submit"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" /> Submitting…
                  </>
                ) : (
                  'Book Appointment'
                )}
              </button>
            )}
          </div>
        </form>
      </Form>
    </div>
  );
}
