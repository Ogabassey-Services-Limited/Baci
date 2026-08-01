import { CheckCircle2 } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';

interface TaxSettingsVatCardProps {
  disabled: boolean;
  initialVatRate: number;
  onToggle: (enabled: boolean) => void;
  vatEnabled: boolean;
}

export function TaxSettingsVatCard({
  disabled,
  initialVatRate,
  onToggle,
  vatEnabled,
}: TaxSettingsVatCardProps) {
  return (
    <Card className="glass">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              VAT Collection
              {vatEnabled && (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-600">
                  <CheckCircle2 className="size-3" />
                  Active
                </span>
              )}
            </CardTitle>
            <CardDescription>
              Enable to charge 7.5% VAT on all orders
            </CardDescription>
          </div>
          <Switch
            checked={vatEnabled}
            disabled={disabled}
            onCheckedChange={onToggle}
          />
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
            <span className="text-sm text-muted-foreground">VAT Rate</span>
            <span className="font-semibold">{initialVatRate}%</span>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
            <span className="text-sm text-muted-foreground">Country</span>
            <span className="font-semibold">Nigeria</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
