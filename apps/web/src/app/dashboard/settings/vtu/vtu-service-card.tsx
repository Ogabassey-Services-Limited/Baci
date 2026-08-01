'use client';

import { AlertCircle, Check, Phone, Wifi } from 'lucide-react';
import type { ReactNode } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import type { VTUSettings } from './vtu-settings-types';

interface VtuServiceCardProps {
  settings: VTUSettings;
  setSettings: (settings: VTUSettings) => void;
}

export function VtuServiceCard({ settings, setSettings }: VtuServiceCardProps) {
  return (
    <>
      {settings.vtu_enabled ? (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-green-50 border border-green-200 text-green-700">
          <Check className="size-5" />
          <div>
            <p className="font-medium">VTU Services Active</p>
            <p className="text-sm">
              Customers can purchase airtime and data from your store.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-700">
          <AlertCircle className="size-5" />
          <div>
            <p className="font-medium">VTU Services Disabled</p>
            <p className="text-sm">
              Enable VTU below to let customers buy airtime and data.
            </p>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="size-5" />
            Enable VTU Services
          </CardTitle>
          <CardDescription>
            Allow customers to purchase airtime and data bundles directly from
            your store.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div
            className={cn(
              'p-4 rounded-lg border-2 transition-colors',
              settings.vtu_enabled
                ? 'border-green-200 bg-green-50/50'
                : 'border-gray-200'
            )}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="size-10 rounded-lg bg-linear-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white">
                  <Phone className="size-5" />
                </div>
                <div>
                  <h3 className="font-semibold">VTU (Value Top-Up)</h3>
                  <p className="text-sm text-muted-foreground">
                    Powered by Kuda. Sell MTN, Airtel, Glo, 9mobile airtime &
                    data.
                  </p>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                      1.5% Cashback
                    </span>
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                      Instant Delivery
                    </span>
                    <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">
                      All Networks
                    </span>
                  </div>
                </div>
              </div>
              <Switch
                checked={settings.vtu_enabled}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, vtu_enabled: checked })
                }
              />
            </div>
          </div>

          {settings.vtu_enabled && (
            <div className="grid md:grid-cols-2 gap-4">
              <VtuOption
                checked={settings.vtu_airtime_enabled}
                description="Enable airtime purchases"
                icon={<Phone className="size-5 text-green-600" />}
                label="Airtime"
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, vtu_airtime_enabled: checked })
                }
              />
              <VtuOption
                checked={settings.vtu_data_enabled}
                description="Enable data purchases"
                icon={<Wifi className="size-5 text-blue-600" />}
                label="Data Bundles"
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, vtu_data_enabled: checked })
                }
              />
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function VtuOption({
  checked,
  description,
  icon,
  label,
  onCheckedChange,
}: {
  checked: boolean;
  description: string;
  icon: ReactNode;
  label: string;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div
      className={cn(
        'p-4 rounded-lg border transition-colors',
        checked ? 'border-green-200 bg-green-50/30' : 'border-gray-200'
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {icon}
          <div>
            <h4 className="font-medium">{label}</h4>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
        <Switch checked={checked} onCheckedChange={onCheckedChange} />
      </div>
    </div>
  );
}
