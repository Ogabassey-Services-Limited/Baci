'use client';

import { Paintbrush } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface ColorPickerFieldProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}

const PRESET_COLORS = [
  '#000000',
  '#FFFFFF',
  '#EF4444',
  '#F97316',
  '#F59E0B',
  '#10B981',
  '#06B6D4',
  '#3B82F6',
  '#6366F1',
  '#8B5CF6',
  '#EC4899',
  'var(--theme-primary)',
  'var(--theme-secondary)',
  'var(--theme-accent)',
  'var(--theme-background)',
  'var(--theme-foreground)',
];

export function ColorPickerField({
  value,
  onChange,
  label,
}: ColorPickerFieldProps) {
  return (
    <div className="space-y-2">
      {label && <Label>{label}</Label>}
      <div className="flex gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-start text-left font-normal px-2"
            >
              <div
                className="w-4 h-4 rounded-full mr-2 border shadow-sm"
                style={{ background: value }}
              />
              <span className="truncate flex-1">{value || 'Select color'}</span>
              <Paintbrush className="h-4 w-4 opacity-50 ml-2" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-3">
            <div className="space-y-3">
              <div className="grid grid-cols-5 gap-2">
                {PRESET_COLORS.map((color) => (
                  <button
                    type="button"
                    key={color}
                    className={cn(
                      'w-8 h-8 rounded-full border shadow-sm transition-transform hover:scale-110 focus:outline-hidden focus:ring-2 focus:ring-ring',
                      value === color && 'ring-2 ring-primary'
                    )}
                    style={{ background: color }}
                    onClick={() => onChange(color)}
                    title={color}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  placeholder="#000000"
                  className="h-8"
                />
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
