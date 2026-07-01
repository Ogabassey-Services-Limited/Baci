import { AlertTriangle, ShieldCheck } from 'lucide-react';
import type { InsuranceCta } from './claim-action-helpers';

interface InsurancePolicyAlertsProps {
  ctaKind: InsuranceCta['kind'];
}

const primaryTintStyle = {
  backgroundColor: 'color-mix(in srgb, var(--store-primary) 10%, transparent)',
  borderColor: 'var(--store-primary)',
  color: 'var(--store-primary)',
} as const;

export function InsurancePolicyAlerts({ ctaKind }: InsurancePolicyAlertsProps) {
  if (ctaKind === 'inspect') {
    return (
      <div
        className="flex items-start gap-3 rounded-lg border p-4"
        style={primaryTintStyle}
      >
        <AlertTriangle className="size-5 shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-semibold">Activate your protection</p>
          <p>
            Complete a quick device inspection (photos of your device) to
            activate this policy. You can only file a claim once your protection
            is active.
          </p>
        </div>
      </div>
    );
  }

  if (ctaKind === 'awaiting_delivery') {
    return (
      <div className="flex items-start gap-3 rounded-lg border bg-muted/40 p-4 text-muted-foreground">
        <ShieldCheck className="size-5 shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-semibold text-foreground">
            Protection activates after delivery
          </p>
          <p>
            Once your order is delivered, you&apos;ll be able to activate your
            protection with a quick device inspection.
          </p>
        </div>
      </div>
    );
  }

  if (ctaKind === 'activation_pending') {
    return (
      <div className="flex items-start gap-3 rounded-lg border bg-muted/40 p-4 text-muted-foreground">
        <ShieldCheck className="size-5 shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-semibold text-foreground">
            Activation link is being prepared
          </p>
          <p>
            We&apos;re waiting for MyCover to send the inspection link for this
            policy. You&apos;ll be able to file a claim after activation is
            complete.
          </p>
        </div>
      </div>
    );
  }

  return null;
}
