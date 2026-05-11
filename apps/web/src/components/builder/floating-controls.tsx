'use client';

import type { ComponentData } from '@puckeditor/core';
import { usePuck } from '@puckeditor/core';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

// Types for Puck field configuration (Puck does not export a public Field union
// in a form that's convenient to consume directly here).
interface FieldOption {
  label: string;
  value: string;
}

interface PuckFieldConfig {
  type: 'text' | 'textarea' | 'number' | 'select' | 'radio' | 'custom';
  label?: string;
  options?: FieldOption[];
  render?: (props: {
    field: PuckFieldConfig;
    name: string;
    value: unknown;
    onChange: (value: unknown) => void;
    readOnly: boolean;
  }) => React.ReactNode;
}

/**
 * Narrowed shape of `appState` returned by Puck's `usePuck()`.
 *
 * Puck's `makeStatePublic` returns `{ data, ui }` only — `config` is a sibling
 * field on the `usePuck()` return value, NOT nested inside `appState`. This
 * type intentionally mirrors `AppState<Data>` from `@puckeditor/core` (see
 * `node_modules/@puckeditor/core/dist/actions-*.d.ts`) so the type guard below
 * actually matches reality.
 */
interface PuckAppStateLike {
  ui: {
    // `UiState` from Puck core has `itemSelector` (NOT `selectedItem`).
    // The `selectedItem` lives at the top level of `usePuck()`'s return.
    itemSelector: { index: number; zone?: string } | null;
    [key: string]: unknown;
  };
  data: {
    content: ComponentData[];
    root: Record<string, unknown>;
    zones?: Record<string, ComponentData[]>;
  };
}

function isPuckAppStateLike(value: unknown): value is PuckAppStateLike {
  if (typeof value !== 'object' || value === null) return false;
  if (!('ui' in value) || !('data' in value)) return false;
  const data = (value as { data?: unknown }).data;
  if (typeof data !== 'object' || data === null) return false;
  if (!('content' in data)) return false;
  if (!Array.isArray((data as { content?: unknown }).content)) return false;
  return true;
}

export function FloatingControls() {
  // `config` and `selectedItem` are SIBLINGS of `appState` on the usePuck()
  // return value — not nested inside appState. See UsePuckData in
  // node_modules/@puckeditor/core/dist/index.d.ts.
  const { appState, dispatch, config, selectedItem } = usePuck();

  if (!isPuckAppStateLike(appState)) return null;
  if (!selectedItem?.props) return null;
  if (!config?.components) return null;

  const componentConfig = config.components[selectedItem.type];
  if (!componentConfig) return null;

  const fields = componentConfig.fields;
  if (!fields) return null;

  const safeFieldChange = (fieldName: string, value: unknown) => {
    const newContent = [...appState.data.content];
    const itemIndex = newContent.findIndex(
      (item) => item.props.id === selectedItem.props.id
    );

    if (itemIndex !== -1) {
      newContent[itemIndex] = {
        ...newContent[itemIndex],
        props: {
          ...newContent[itemIndex].props,
          [fieldName]: value,
        },
      };

      dispatch({
        type: 'setData',
        data: { ...appState.data, content: newContent },
      });
    }
  };

  return (
    <div className="fixed right-6 top-24 z-[60] w-80 bg-background/95 backdrop-blur-md border rounded-lg shadow-xl overflow-hidden flex flex-col max-h-[calc(100vh-8rem)] animate-in slide-in-from-right-5 duration-200">
      <div className="flex items-center justify-between p-4 border-b bg-muted/30">
        <h3 className="font-semibold text-sm">
          Edit {componentConfig.label || selectedItem.type}
        </h3>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() =>
            // Puck derives `selectedItem` from `ui.itemSelector` in its reducer
            // (see makeStatePublic). Setting `itemSelector: null` is the
            // correct way to clear the selection.
            dispatch({ type: 'setUi', ui: { itemSelector: null } })
          }
          aria-label="Close controls"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="p-4 space-y-6 overflow-y-auto custom-scrollbar">
        {Object.entries(fields as Record<string, PuckFieldConfig>).map(
          ([fieldName, fieldConfig]) => {
            const value = selectedItem.props[fieldName];
            const label = fieldConfig.label || fieldName;

            return (
              <div key={fieldName} className="space-y-2">
                {fieldConfig.type !== 'custom' && <Label>{label}</Label>}

                {fieldConfig.type === 'text' && (
                  <Input
                    value={(value as string) || ''}
                    onChange={(e) => safeFieldChange(fieldName, e.target.value)}
                  />
                )}

                {fieldConfig.type === 'textarea' && (
                  <Textarea
                    value={(value as string) || ''}
                    onChange={(e) => safeFieldChange(fieldName, e.target.value)}
                    className="min-h-[80px]"
                  />
                )}

                {fieldConfig.type === 'number' && (
                  <Input
                    type="number"
                    value={(value as number) || ''}
                    onChange={(e) =>
                      safeFieldChange(fieldName, Number(e.target.value))
                    }
                  />
                )}

                {fieldConfig.type === 'select' && fieldConfig.options && (
                  <Select
                    value={(value as string) || ''}
                    onValueChange={(v) => safeFieldChange(fieldName, v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      {fieldConfig.options.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {fieldConfig.type === 'radio' && fieldConfig.options && (
                  <RadioGroup
                    value={(value as string) || ''}
                    onValueChange={(v) => safeFieldChange(fieldName, v)}
                    className="flex flex-col gap-2"
                  >
                    {fieldConfig.options.map((opt) => (
                      <div
                        key={opt.value}
                        className="flex items-center space-x-2"
                      >
                        <RadioGroupItem
                          value={opt.value}
                          id={`${fieldName}-${opt.value}`}
                        />
                        <Label htmlFor={`${fieldName}-${opt.value}`}>
                          {opt.label}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                )}

                {fieldConfig.type === 'custom' && fieldConfig.render && (
                  <div className="custom-field-wrapper">
                    {fieldConfig.render({
                      field: fieldConfig,
                      name: fieldName,
                      value,
                      onChange: (v: unknown) => safeFieldChange(fieldName, v),
                      readOnly: false,
                    })}
                  </div>
                )}
              </div>
            );
          }
        )}
      </div>
    </div>
  );
}
