'use client';

import { Loader2, XCircle } from 'lucide-react';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { MAX_CANCELLATION_REASON_LENGTH } from '@/config/order-cancellation';
import { fetchWithCsrf } from '@/lib/api-client';
import { CUSTOMER_CANCELLATION_REASONS } from '@/lib/post-purchase-actions';

interface CancelOrderDialogProps {
  orderId: string;
  /**
   * Called after the order view should be refreshed: on a successful
   * cancellation AND on a 409 (the server now considers the order
   * un-cancellable, so the stale CTA must disappear).
   */
  onCancelled?: () => void;
}

const OTHER_REASON = 'Other';
const NOT_CANCELLABLE_MESSAGE = 'This order can no longer be cancelled.';
const GENERIC_ERROR_MESSAGE =
  "We couldn't cancel this order. Please try again.";

function buildCancellationReasonItemId(baseId: string, index: number) {
  return `${baseId}-reason-${index}`;
}

type CancelState =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'error'; message: string };

function resolveReason(
  selectedReason: string,
  otherReason: string
): string | undefined {
  if (!selectedReason) {
    return undefined;
  }

  if (selectedReason === OTHER_REASON) {
    const trimmed = otherReason.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  return selectedReason;
}

export function CancelOrderDialog({
  orderId,
  onCancelled,
}: CancelOrderDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedReason, setSelectedReason] = useState('');
  const [otherReason, setOtherReason] = useState('');
  const [state, setState] = useState<CancelState>({ status: 'idle' });
  const radioGroupLabelId = useId();
  const otherFieldId = useId();

  const isSubmitting = state.status === 'submitting';

  const handleOpenChange = (next: boolean) => {
    if (isSubmitting) {
      return;
    }
    setOpen(next);
    if (!next) {
      setSelectedReason('');
      setOtherReason('');
      setState({ status: 'idle' });
    }
  };

  const handleConfirm = async () => {
    setState({ status: 'submitting' });
    const reason = resolveReason(selectedReason, otherReason);

    try {
      const response = await fetchWithCsrf(
        `/api/storefront/account/orders/${orderId}/cancel`,
        {
          method: 'POST',
          body: JSON.stringify(reason ? { reason } : {}),
        }
      );

      if (response.ok) {
        setState({ status: 'idle' });
        setSelectedReason('');
        setOtherReason('');
        setOpen(false);
        onCancelled?.();
        return;
      }

      if (response.status === 409) {
        setState({ status: 'error', message: NOT_CANCELLABLE_MESSAGE });
        onCancelled?.();
        return;
      }

      setState({ status: 'error', message: GENERIC_ERROR_MESSAGE });
    } catch {
      setState({ status: 'error', message: GENERIC_ERROR_MESSAGE });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="w-full" variant="outline">
          <XCircle className="mr-2 size-4" aria-hidden="true" />
          Cancel Order
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel this order?</DialogTitle>
          <DialogDescription>
            Once cancelled, this order can&apos;t be reopened. Let us know why
            (optional).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm font-medium" id={radioGroupLabelId}>
            Reason for cancellation
          </p>
          <RadioGroup
            aria-labelledby={radioGroupLabelId}
            value={selectedReason}
            onValueChange={setSelectedReason}
            disabled={isSubmitting}
          >
            {CUSTOMER_CANCELLATION_REASONS.map((reason, index) => {
              const itemId = buildCancellationReasonItemId(
                radioGroupLabelId,
                index
              );
              return (
                <div className="flex items-center gap-2" key={reason}>
                  <RadioGroupItem id={itemId} value={reason} />
                  <Label className="font-normal" htmlFor={itemId}>
                    {reason}
                  </Label>
                </div>
              );
            })}
          </RadioGroup>

          {selectedReason === OTHER_REASON ? (
            <div className="space-y-2">
              <Label htmlFor={otherFieldId}>Tell us more</Label>
              <Textarea
                disabled={isSubmitting}
                id={otherFieldId}
                maxLength={MAX_CANCELLATION_REASON_LENGTH}
                onChange={(event) => setOtherReason(event.target.value)}
                placeholder="Add an optional note"
                value={otherReason}
              />
            </div>
          ) : null}

          {state.status === 'error' ? (
            <p className="text-sm text-destructive" role="alert">
              {state.message}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            disabled={isSubmitting}
            onClick={() => handleOpenChange(false)}
            type="button"
            variant="ghost"
          >
            Keep Order
          </Button>
          <Button
            disabled={isSubmitting}
            onClick={handleConfirm}
            type="button"
            variant="destructive"
          >
            {isSubmitting ? (
              <>
                <Loader2
                  className="mr-2 size-4 motion-safe:animate-spin"
                  aria-hidden="true"
                />
                Cancelling…
              </>
            ) : (
              'Confirm Cancellation'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
