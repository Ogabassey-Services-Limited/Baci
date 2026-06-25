import { ExternalLink, FileText, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CardFooter } from '@/components/ui/card';
import type { InsuranceCta } from './claim-action-helpers';

interface InsurancePolicyFooterActionsProps {
  certificateUrl: string | null;
  cta: InsuranceCta;
  onCompleteInspection: () => void;
  onFileClaim: () => void;
}

export function InsurancePolicyFooterActions({
  certificateUrl,
  cta,
  onCompleteInspection,
  onFileClaim,
}: InsurancePolicyFooterActionsProps) {
  return (
    <CardFooter className="flex flex-col sm:flex-row gap-3 pt-4">
      {certificateUrl && (
        <Button variant="outline" className="w-full sm:w-auto gap-2" asChild>
          <a href={certificateUrl} target="_blank" rel="noopener noreferrer">
            <FileText className="size-4" /> Download Certificate
          </a>
        </Button>
      )}

      {cta.kind === 'inspect' && (
        <Button
          className="w-full sm:w-auto gap-2 sm:ml-auto"
          onClick={onCompleteInspection}
        >
          <ShieldCheck className="size-4" />
          Activate Protection
        </Button>
      )}

      {cta.kind === 'claim' && (
        <Button
          className="w-full sm:w-auto gap-2 sm:ml-auto"
          onClick={onFileClaim}
        >
          <ExternalLink className="size-4" />
          File a Claim
        </Button>
      )}

      {cta.kind === 'awaiting_delivery' && (
        <p className="text-sm text-muted-foreground sm:ml-auto sm:self-center">
          Available after delivery
        </p>
      )}

      {cta.kind === 'activation_pending' && (
        <p className="text-sm text-muted-foreground sm:ml-auto sm:self-center">
          Activation link pending
        </p>
      )}

      {cta.kind === 'claim_existing' && cta.url && (
        <Button
          className="w-full sm:w-auto gap-2 sm:ml-auto"
          onClick={onFileClaim}
        >
          <ExternalLink className="size-4" />
          Continue Claim
        </Button>
      )}

      {cta.kind === 'claim_existing' && !cta.url && (
        <p className="text-sm text-muted-foreground sm:ml-auto sm:self-center">
          Existing claim in progress
        </p>
      )}

      {cta.kind === 'claim_terminal' && (
        <p className="text-sm text-muted-foreground sm:ml-auto sm:self-center">
          Claim closed
        </p>
      )}
    </CardFooter>
  );
}
