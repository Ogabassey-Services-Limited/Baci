import type { UseFormReturn } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { TrustFieldConfig } from './trust-settings-fields';
import type {
  TrustFieldName,
  TrustFormValues,
} from './trust-settings-form-data';

interface TrustSettingsFieldProps {
  form: UseFormReturn<TrustFormValues>;
  config: TrustFieldConfig;
}

export function TrustSettingsField({ form, config }: TrustSettingsFieldProps) {
  const id = `trust-${config.name}`;
  const fieldName = config.name as TrustFieldName;
  const fieldError = form.formState.errors[fieldName];
  const fieldErrorId = fieldError ? `${id}-error` : undefined;
  const commonProps = {
    id,
    placeholder: config.placeholder,
    ...form.register(fieldName),
  };

  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="text-sm font-medium">
        {config.label}
      </label>
      {config.kind === 'select' ? (
        <select
          aria-describedby={fieldErrorId}
          aria-errormessage={fieldErrorId}
          aria-invalid={fieldError ? 'true' : 'false'}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          {...commonProps}
        >
          {config.options?.map((option) => (
            <option key={option.value || 'empty'} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : config.kind === 'textarea' ? (
        <Textarea
          aria-describedby={fieldErrorId}
          aria-errormessage={fieldErrorId}
          aria-invalid={fieldError ? 'true' : 'false'}
          className="min-h-24"
          {...commonProps}
        />
      ) : (
        <Input
          aria-describedby={fieldErrorId}
          aria-errormessage={fieldErrorId}
          aria-invalid={fieldError ? 'true' : 'false'}
          type={config.type}
          {...commonProps}
        />
      )}
      {fieldError?.message ? (
        <p id={fieldErrorId} className="text-sm text-destructive" role="alert">
          {fieldError.message}
        </p>
      ) : null}
    </div>
  );
}
