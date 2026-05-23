import { agenticActionCenterCardHelpers } from '@/components/dashboard/agentic-action-center-card-helpers';
import type { AgenticActionRequestRecord } from '@/schemas/agentic-action-health';

interface AgenticRecentSignedRequestsCardProps {
  recentRequestCount: number;
  recentRequestRecords: AgenticActionRequestRecord[];
}

function formatRequestApiVersion(apiVersion: string | null): string {
  const trimmed = apiVersion?.trim();
  return `API ${trimmed || 'unknown'}`;
}

function formatRequestTimestamp(value: string): string {
  return agenticActionCenterCardHelpers.formatGeneratedAt(value) ?? value;
}

export function AgenticRecentSignedRequestsCard({
  recentRequestCount,
  recentRequestRecords,
}: AgenticRecentSignedRequestsCardProps) {
  const recentRequestKeyCounts = new Map<string, number>();
  const recentRequestRows = recentRequestRecords.map((record) => {
    const baseKey = `${record.created_at}-${record.expires_at}-${
      record.api_version ?? 'unknown'
    }`;
    const previousCount = recentRequestKeyCounts.get(baseKey) ?? 0;
    recentRequestKeyCounts.set(baseKey, previousCount + 1);

    return {
      key: previousCount === 0 ? baseKey : `${baseKey}-${previousCount + 1}`,
      record,
    };
  });

  return (
    <div className="rounded-md border bg-muted/20 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase text-muted-foreground">
          Recent signed requests
        </p>
        <p className="text-xs text-muted-foreground">
          {agenticActionCenterCardHelpers.formatPatternCount(
            recentRequestCount,
            'recent request'
          )}
        </p>
      </div>
      {recentRequestRows.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
          {recentRequestRows.map(({ key, record }) => (
            <li key={key}>
              <span className="font-medium text-foreground">
                {formatRequestApiVersion(record.api_version)}
              </span>{' '}
              signed at {formatRequestTimestamp(record.created_at)}.
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
