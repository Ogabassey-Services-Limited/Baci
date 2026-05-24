import { agenticActionCenterCardHelpers } from '@/components/dashboard/agentic-action-center-card-helpers';
import type { AgenticActionHealthPayload } from '@/schemas/agentic-action-health';

type AgenticActionRequestControls = NonNullable<
  AgenticActionHealthPayload['request_controls']
>;

interface AgenticRequestControlsCardProps {
  requestControls: AgenticActionRequestControls;
}

export function AgenticRequestControlsCard({
  requestControls,
}: AgenticRequestControlsCardProps) {
  return (
    <div className="rounded-md border bg-muted/20 p-3">
      <p className="text-xs font-medium uppercase text-muted-foreground">
        Request controls
      </p>
      <div className="mt-2 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
        <p className="font-medium text-foreground">
          Agent checkout{' '}
          {requestControls.is_agentic_checkout_enabled ? 'enabled' : 'disabled'}
        </p>
        <p>
          {agenticActionCenterCardHelpers.formatPatternCount(
            requestControls.allowlist_count,
            'trusted pattern'
          )}
        </p>
        <p>
          {agenticActionCenterCardHelpers.formatPatternCount(
            requestControls.denylist_count,
            'blocked pattern'
          )}
        </p>
      </div>
      {requestControls.fetch_error && (
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-200">
          Controls could not be refreshed.
        </p>
      )}
    </div>
  );
}
