import type { ImportJobDetail } from '@/app/dashboard/migrations/migration-types';

type ReceiptCampaign = NonNullable<ImportJobDetail['receiptCampaign']>;
type ReceiptCampaignRecipient = ReceiptCampaign['recipients'][number];

interface ReceiptCampaignSummaryProps {
  receiptCampaign: ReceiptCampaign;
  sentCountFallback: number;
}

function formatCampaignRate(count: number, total: number) {
  if (total <= 0) {
    return '0%';
  }

  return `${Math.round((count / total) * 100)}%`;
}

function formatCampaignTimestamp(value: string | null) {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return '-';
  }

  return new Intl.DateTimeFormat('en-NG', {
    dateStyle: 'medium',
    timeZone: 'Africa/Lagos',
    timeStyle: 'short',
  }).format(date);
}

function formatCountLabel(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function formatChannelBreakdown(
  webCount: number,
  appCount: number,
  unknownCount: number
) {
  const parts = [`Web ${webCount}`, `App ${appCount}`];
  if (unknownCount > 0) {
    parts.push(`Unknown ${unknownCount}`);
  }

  return parts.join(' · ');
}

function formatClaimSource(source: ReceiptCampaignRecipient['claimedSource']) {
  if (source === 'app') {
    return 'Claimed via app';
  }

  if (source === 'web') {
    return 'Claimed via web';
  }

  if (source === 'unknown') {
    return 'Claimed via unknown source';
  }

  return null;
}

function getRecipientStatus(recipient: ReceiptCampaignRecipient) {
  if (recipient.claimedAt) {
    return 'Claimed';
  }

  if (recipient.firstLoginStartedAt) {
    return 'Login started';
  }

  if (recipient.firstClickedAt) {
    return 'Clicked';
  }

  if (recipient.notificationSentAt) {
    return 'Sent';
  }

  return 'Pending';
}

export default function ReceiptCampaignSummary({
  receiptCampaign,
  sentCountFallback,
}: ReceiptCampaignSummaryProps) {
  const effectiveSentCount =
    receiptCampaign.sentCount || sentCountFallback || 0;
  const campaignTotal =
    effectiveSentCount || receiptCampaign.totalRecipients || 0;
  // Horizontal overflow tables need a keyboard focus target so users can scroll
  // to later columns without pointer input.
  const keyboardScrollableRegionProps = { tabIndex: 0 };

  return (
    <section className="space-y-4 rounded-xl border bg-muted/20 p-4">
      <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
        <div>
          <h3 className="text-sm font-semibold">Receipt campaign</h3>
          <p className="text-sm text-muted-foreground">
            Last activity{' '}
            {formatCampaignTimestamp(receiptCampaign.lastActivityAt)}
          </p>
        </div>
        <p className="text-sm font-medium text-muted-foreground">
          Claim rate{' '}
          {formatCampaignRate(receiptCampaign.claimedCount, campaignTotal)}
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-5">
        {[
          {
            label: 'Emails sent',
            value: effectiveSentCount,
          },
          {
            label: 'Link clicked',
            secondary: formatChannelBreakdown(
              receiptCampaign.clickedWebCount,
              receiptCampaign.clickedAppCount,
              receiptCampaign.clickedUnknownCount
            ),
            value: receiptCampaign.clickedCount,
          },
          {
            label: 'Login started',
            secondary: formatChannelBreakdown(
              receiptCampaign.loginStartedWebCount,
              receiptCampaign.loginStartedAppCount,
              receiptCampaign.loginStartedUnknownCount
            ),
            value: receiptCampaign.loginStartedCount,
          },
          {
            label: 'Receipt claimed',
            secondary: formatChannelBreakdown(
              receiptCampaign.claimedWebCount,
              receiptCampaign.claimedAppCount,
              receiptCampaign.claimedUnknownCount
            ),
            value: receiptCampaign.claimedCount,
          },
          {
            label: 'Store-link taps',
            secondary: formatCountLabel(
              receiptCampaign.appDownloadClickedCount,
              'recipient',
              'recipients'
            ),
            value: receiptCampaign.appDownloadClickCount,
          },
        ].map((metric) => (
          <div
            className="rounded-lg border bg-background p-3"
            key={metric.label}
          >
            <p className="text-xs uppercase text-muted-foreground">
              {metric.label}
            </p>
            <p className="mt-2 text-xl font-semibold">{metric.value}</p>
            {metric.secondary ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {metric.secondary}
              </p>
            ) : null}
          </div>
        ))}
      </div>

      <section
        aria-label="Receipt campaign recipients"
        className="overflow-x-auto rounded-lg border bg-background"
        {...keyboardScrollableRegionProps}
      >
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Customer</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Sent</th>
              <th className="px-3 py-2 font-medium">Clicked</th>
              <th className="px-3 py-2 font-medium">Claimed</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {receiptCampaign.recipients.length > 0 ? (
              receiptCampaign.recipients.map((recipient) => (
                <tr key={recipient.id}>
                  <td className="px-3 py-3">
                    <div className="font-medium">
                      {recipient.customerName || 'Unknown customer'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {recipient.customerEmail}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div>{getRecipientStatus(recipient)}</div>
                    {formatClaimSource(recipient.claimedSource) ? (
                      <div className="text-xs text-muted-foreground">
                        {formatClaimSource(recipient.claimedSource)}
                      </div>
                    ) : null}
                    {recipient.appDownloadClickCount > 0 ? (
                      <div className="text-xs text-muted-foreground">
                        Store taps: {recipient.appDownloadClickCount}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">
                    {formatCampaignTimestamp(recipient.notificationSentAt)}
                  </td>
                  <td className="px-3 py-3">
                    <div>
                      {formatCampaignTimestamp(recipient.firstClickedAt)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatCountLabel(
                        recipient.clickCount,
                        'click',
                        'clicks'
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">
                    {formatCampaignTimestamp(recipient.claimedAt)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-3 py-4 text-muted-foreground" colSpan={5}>
                  No receipt notification recipients yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </section>
  );
}
