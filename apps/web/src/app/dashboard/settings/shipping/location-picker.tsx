'use client';

import { MapPin, Plus, X } from 'lucide-react';
import { useId } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { COUNTRIES } from '@/lib/countries';
import { getSubdivisions } from '@/lib/shipping/merchant-rates/subdivisions';
import type { ZoneLocationFormInput } from '@/schemas/merchant-shipping-rate-forms';

interface CountryRow {
  countryCode: string;
  /** Empty = whole country. */
  subdivisionCodes: string[];
}

/** Flat `(country, subdivision|null)` rows -> one editable row per country. */
function toCountryRows(locations: ZoneLocationFormInput[]): CountryRow[] {
  const byCountry = new Map<string, CountryRow>();
  for (const location of locations) {
    const existing = byCountry.get(location.countryCode);
    if (!existing) {
      byCountry.set(location.countryCode, {
        countryCode: location.countryCode,
        subdivisionCodes: location.subdivisionCode
          ? [location.subdivisionCode]
          : [],
      });
      continue;
    }
    // A null (whole-country) entry always wins over specific subdivisions.
    if (location.subdivisionCode && existing.subdivisionCodes.length > 0) {
      existing.subdivisionCodes.push(location.subdivisionCode);
    } else if (!location.subdivisionCode) {
      existing.subdivisionCodes = [];
    }
  }
  return Array.from(byCountry.values());
}

function toLocations(rows: CountryRow[]): ZoneLocationFormInput[] {
  return rows.flatMap((row): ZoneLocationFormInput[] =>
    row.subdivisionCodes.length === 0
      ? [{ countryCode: row.countryCode, subdivisionCode: null }]
      : row.subdivisionCodes.map((code) => ({
          countryCode: row.countryCode,
          subdivisionCode: code,
        }))
  );
}

interface LocationPickerProps {
  value: ZoneLocationFormInput[];
  onChange: (locations: ZoneLocationFormInput[]) => void;
}

/**
 * Country + optional subdivision multi-select for a zone's location set.
 * Empty subdivision selection means "whole country" — the matching engine
 * treats a `subdivisionCode: null` row as covering every subdivision.
 */
export function LocationPicker({ value, onChange }: LocationPickerProps) {
  const pickerId = useId();
  const rows = toCountryRows(value);
  const usedCountryCodes = new Set(rows.map((row) => row.countryCode));
  const availableCountries = COUNTRIES.filter(
    (country) => !usedCountryCodes.has(country.code)
  );

  function updateRows(next: CountryRow[]) {
    onChange(toLocations(next));
  }

  function addCountry(countryCode: string) {
    updateRows([...rows, { countryCode, subdivisionCodes: [] }]);
  }

  function removeCountry(countryCode: string) {
    updateRows(rows.filter((row) => row.countryCode !== countryCode));
  }

  function toggleSubdivision(countryCode: string, subdivisionCode: string) {
    updateRows(
      rows.map((row) => {
        if (row.countryCode !== countryCode) {
          return row;
        }
        const isSelected = row.subdivisionCodes.includes(subdivisionCode);
        return {
          ...row,
          subdivisionCodes: isSelected
            ? row.subdivisionCodes.filter((code) => code !== subdivisionCode)
            : [...row.subdivisionCodes, subdivisionCode],
        };
      })
    );
  }

  return (
    <div className="space-y-3">
      <span className="text-sm font-medium leading-none">Locations</span>
      <p className="text-xs text-muted-foreground">
        Leave a country's states unselected to cover the whole country.
      </p>

      <div className="space-y-2">
        {rows.map((row) => {
          const country = COUNTRIES.find((c) => c.code === row.countryCode);
          const subdivisions = getSubdivisions(row.countryCode);
          return (
            <div
              key={row.countryCode}
              className="flex items-center justify-between gap-2 rounded-md border p-2"
            >
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="size-4 text-muted-foreground" />
                <span className="font-medium">
                  {country?.name ?? row.countryCode}
                </span>
                <Badge variant="secondary">
                  {row.subdivisionCodes.length === 0
                    ? 'Whole country'
                    : `${row.subdivisionCodes.length} selected`}
                </Badge>
              </div>
              <div className="flex items-center gap-1">
                {subdivisions.length > 0 && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button type="button" variant="outline" size="sm">
                        Select states
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64" align="end">
                      <ScrollArea className="h-56 pr-2">
                        <div className="space-y-2">
                          {subdivisions.map((subdivision) => (
                            <div
                              key={subdivision.code}
                              className="flex items-center gap-2"
                            >
                              <Checkbox
                                id={`${pickerId}-${subdivision.code}`}
                                checked={row.subdivisionCodes.includes(
                                  subdivision.code
                                )}
                                onCheckedChange={() =>
                                  toggleSubdivision(
                                    row.countryCode,
                                    subdivision.code
                                  )
                                }
                              />
                              <Label
                                htmlFor={`${pickerId}-${subdivision.code}`}
                                className="text-sm font-normal"
                              >
                                {subdivision.name}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </PopoverContent>
                  </Popover>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${country?.name ?? row.countryCode}`}
                  onClick={() => removeCountry(row.countryCode)}
                >
                  <X className="size-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {availableCountries.length > 0 && (
        <Select onValueChange={addCountry} value="">
          <SelectTrigger id={`${pickerId}-add`} aria-label="Add a country">
            <Plus className="size-4" />
            <SelectValue placeholder="Add a country" />
          </SelectTrigger>
          <SelectContent>
            {availableCountries.map((country) => (
              <SelectItem key={country.code} value={country.code}>
                {country.flag} {country.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
