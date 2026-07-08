'use client';

import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { RepairSettingsInput } from '@/schemas/merchant-features';
import { getRepairSettings, saveRepairSettings } from './bookings-api';

type Values = {
  pickup_enabled: boolean;
  pickup_address: string;
  contact_name: string;
  contact_phone: string;
  contact_email: string;
  city: string;
  state: string;
  country: string;
};

const EMPTY: Values = {
  pickup_enabled: false,
  pickup_address: '',
  contact_name: '',
  contact_phone: '',
  contact_email: '',
  city: '',
  state: '',
  country: 'Nigeria',
};

function fromSettings(settings: RepairSettingsInput | null): Values {
  return {
    pickup_enabled: settings?.pickup_enabled ?? false,
    pickup_address: settings?.pickup_address ?? '',
    contact_name: settings?.contact_name ?? '',
    contact_phone: settings?.contact_phone ?? '',
    contact_email: settings?.contact_email ?? '',
    city: settings?.city ?? '',
    state: settings?.state ?? '',
    country: settings?.country ?? 'Nigeria',
  };
}

const TEXT_FIELDS: { key: keyof Values; label: string; type?: string }[] = [
  { key: 'pickup_address', label: 'Repair-center address' },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'country', label: 'Country' },
  { key: 'contact_name', label: 'Contact name' },
  { key: 'contact_phone', label: 'Contact phone' },
  { key: 'contact_email', label: 'Contact email', type: 'email' },
];

export function RepairSettingsCard() {
  const [values, setValues] = useState<Values>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getRepairSettings()
      .then(({ repairSettings }) => {
        if (!cancelled) {
          setValues(fromSettings(repairSettings));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMessage('Failed to load repair settings.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setField = (key: keyof Values, value: string | boolean) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    setSaving(true);
    setMessage(null);
    saveRepairSettings(values)
      .then(() => setMessage('Repair settings saved.'))
      .catch(() => setMessage('Failed to save. Check the email and try again.'))
      .finally(() => setSaving(false));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Repair-center pickup address
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground text-sm">
          Used privately to arrange courier pickups. It is never shown to
          customers — only pickup prices are.
        </p>

        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          </div>
        ) : (
          <>
            <label className="flex items-center gap-2 text-sm">
              <input
                checked={values.pickup_enabled}
                onChange={(event) =>
                  setField('pickup_enabled', event.target.checked)
                }
                type="checkbox"
              />
              Offer courier pickup
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              {TEXT_FIELDS.map((field) => (
                <div className="space-y-1" key={field.key}>
                  <Label htmlFor={`repair-setting-${field.key}`}>
                    {field.label}
                  </Label>
                  <Input
                    id={`repair-setting-${field.key}`}
                    onChange={(event) =>
                      setField(field.key, event.target.value)
                    }
                    type={field.type ?? 'text'}
                    value={String(values[field.key] ?? '')}
                  />
                </div>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <Button disabled={saving} onClick={handleSave} type="button">
                Save settings
              </Button>
              {message ? (
                <span className="text-muted-foreground text-sm">{message}</span>
              ) : null}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
