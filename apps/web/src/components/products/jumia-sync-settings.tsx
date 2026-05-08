'use client';

import { RefreshCw } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

export interface JumiaOverrides {
  price: string;
  salePrice: string;
  saleStart: string;
  saleEnd: string;
  isActive: boolean;
  syncInventory: boolean;
  syncPrice: boolean;
}

interface JumiaSyncSettingsProps {
  overrides: JumiaOverrides;
  setOverrides: React.Dispatch<React.SetStateAction<JumiaOverrides>>;
}

export function JumiaSyncSettings({
  overrides,
  setOverrides,
}: JumiaSyncSettingsProps) {
  return (
    <div className="flex flex-col gap-3 p-4 rounded-xl border bg-muted/30">
      <div className="flex items-center gap-2 mb-1">
        <RefreshCw
          className={cn(
            'h-4 w-4',
            overrides.syncInventory || overrides.syncPrice
              ? 'text-(--store-primary)'
              : 'text-muted-foreground'
          )}
        />
        <span className="text-sm font-semibold">Real-time Sync</span>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-sm cursor-pointer" htmlFor="sync-stock">
              Sync Inventory
            </Label>
            <p className="text-[10px] text-muted-foreground">
              Keep Jumia stock matched with Baci
            </p>
          </div>
          <Switch
            id="sync-stock"
            checked={overrides.syncInventory}
            onCheckedChange={(checked) =>
              setOverrides((prev) => ({
                ...prev,
                syncInventory: checked,
              }))
            }
          />
        </div>

        <div className="flex items-center justify-between border-t pt-3">
          <div className="space-y-0.5">
            <Label className="text-sm cursor-pointer" htmlFor="sync-price">
              Sync Price changes
            </Label>
            <p className="text-[10px] text-muted-foreground">
              Auto-update Jumia when Baci price changes
            </p>
          </div>
          <Switch
            id="sync-price"
            checked={overrides.syncPrice}
            onCheckedChange={(checked) =>
              setOverrides((prev) => ({ ...prev, syncPrice: checked }))
            }
          />
        </div>
      </div>
    </div>
  );
}
