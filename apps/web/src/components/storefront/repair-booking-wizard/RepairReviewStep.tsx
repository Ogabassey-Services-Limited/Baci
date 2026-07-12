import { AlertCircle, CheckCircle } from 'lucide-react';
import type { ShippingCalculationResult } from '@/app/actions/repair';
import { cn } from '@/lib/utils';

interface RepairReviewFormData {
  deviceType?: string;
  deviceModel?: string;
  issueDescription?: string;
  customerName?: string;
  customerPhone?: string;
  preferredDate?: string;
  serviceType?: string;
  pickupAddress?: string;
}

interface RepairReviewStepProps {
  formData: RepairReviewFormData;
  shippingQuote: ShippingCalculationResult | null;
}

/**
 * Step 2 of the repair booking wizard: a read-only summary of everything the
 * customer entered, plus the "this isn't a confirmed appointment yet" notice.
 * Pure presentational — no react-hook-form dependency.
 */
export function RepairReviewStep({
  formData,
  shippingQuote,
}: RepairReviewStepProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-4 rounded-lg bg-muted/50 p-6">
        <h3 className="flex items-center gap-2 text-lg font-semibold">
          <CheckCircle className="size-5 text-primary" /> Summary
        </h3>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Device</p>
            <p className="font-medium">
              {formData.deviceType} - {formData.deviceModel}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Issue</p>
            <p className="font-medium">{formData.issueDescription}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Contact</p>
            <p className="font-medium">{formData.customerName}</p>
            <p className="text-xs text-muted-foreground">
              {formData.customerPhone}
            </p>
          </div>
          <div>
            <p className="font-medium">
              {formData.preferredDate
                ? new Date(formData.preferredDate).toLocaleDateString()
                : 'As soon as possible'}
            </p>
          </div>
          <div className="col-span-2">
            <p className="text-muted-foreground">Service Method</p>
            <div className="flex items-center justify-between">
              <p className="flex items-center font-medium capitalize">
                {formData.serviceType}
                {formData.serviceType === 'pickup' &&
                  formData.pickupAddress && (
                    <span className="ml-2 block max-w-[200px] truncate text-xs text-muted-foreground">
                      ({formData.pickupAddress})
                    </span>
                  )}
              </p>
              {formData.serviceType === 'pickup' && shippingQuote && (
                <span
                  className={cn(
                    'rounded px-2 py-0.5 text-sm font-bold',
                    shippingQuote.isFree
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-700'
                  )}
                >
                  {shippingQuote.formattedPrice}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-md bg-blue-50 p-4 text-sm text-blue-800">
        <AlertCircle className="mt-0.5 size-5 shrink-0" />
        <p>
          Submitting this request does not guarantee an appointment slot. The
          merchant will review and confirm availability.
        </p>
      </div>
    </div>
  );
}
