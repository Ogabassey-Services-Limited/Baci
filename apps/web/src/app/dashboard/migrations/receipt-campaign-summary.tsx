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
    timeStyle: 'short',
  }).format(date);
}

function formatCountLabel(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
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
  const campaignTotal =
    receiptCampaign.sentCount ||
    sentCountFallback ||
    receiptCampaign.totalRecipients ||
    0;

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

      <div className="grid gap-3 md:grid-cols-4">
        {[
          {
            label: 'Emails sent',
            value: receiptCampaign.sentCount,
          },
          {
            label: 'Link clicked',
            value: receiptCampaign.clickedCount,
          },
          {
            label: 'Login started',
            value: receiptCampaign.loginStartedCount,
          },
          {
            label: 'Receipt claimed',
            value: receiptCampaign.claimedCount,
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
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border bg-background">
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
                  <td className="px-3 py-3">{getRecipientStatus(recipient)}</td>
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
      </div>
    </section>
  );
}
