'use client';

import { ArrowLeft } from 'lucide-react';
import type React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export function CacConfirmStep({
  company,
  onBack,
  onConfirm,
}: {
  company: CacCompany;
  onBack: () => void;
  onConfirm: () => void;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-lg font-semibold">{company.approvedName}</p>
        <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
          <span>{company.rcNumber}</span>
          <StatusBadge status={company.status} />
        </div>
        <div className="mt-6 flex gap-3">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button onClick={onConfirm}>Confirm &amp; Upload Certificate</Button>
        </div>
      </CardContent>
    </Card>
  );
}

export interface CacCompany {
  approvedName: string;
  rcNumber: string;
  status: string;
}

export function StatusBadge({ status }: { status: string }) {
  const active = status.toLowerCase() === 'active';
  return (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 text-xs font-medium',
        active ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
      )}
    >
      {status}
    </span>
  );
}

export function AlertBanner({
  variant,
  icon: Icon,
  children,
}: {
  variant: 'success' | 'warning';
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  const styles =
    variant === 'success'
      ? 'border-green-200 bg-green-50 text-green-800'
      : 'border-amber-200 bg-amber-50 text-amber-800';
  const iconColor = variant === 'success' ? 'text-green-600' : 'text-amber-600';
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg border px-4 py-3',
        styles
      )}
      role="alert"
    >
      <Icon className={cn('h-5 w-5', iconColor)} />
      <div className="text-sm font-semibold">{children}</div>
    </div>
  );
}
