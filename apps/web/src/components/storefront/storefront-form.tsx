'use client';

import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PhoneInput } from '@/components/ui/phone-input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

export type FormField = {
  id: string;
  type: 'text' | 'email' | 'phone' | 'textarea' | 'select' | 'checkbox';
  label: string;
  placeholder?: string;
  required?: boolean;
  options?: string[]; // For select fields
};

interface StorefrontFormProps {
  formName: string;
  fields: FormField[];
  submitButtonText?: string;
  successMessage?: string;
  merchantId: string;
}

export function StorefrontForm({
  formName,
  fields,
  submitButtonText = 'Submit',
  successMessage = 'Thank you! Your submission has been received.',
  merchantId,
}: StorefrontFormProps) {
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<
    'idle' | 'success' | 'error'
  >('idle');

  const validateField = (field: FormField, value: unknown): string | null => {
    if (field.required && !value) {
      return `${field.label} is required`;
    }

    if (value) {
      switch (field.type) {
        case 'email': {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (typeof value === 'string' && !emailRegex.test(value)) {
            return 'Please enter a valid email address';
          }
          break;
        }
        case 'phone': {
          const phoneRegex = /^[\d\s\-+()]+$/;
          if (typeof value === 'string' && !phoneRegex.test(value)) {
            return 'Please enter a valid phone number';
          }
          break;
        }
      }
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setSubmitStatus('idle');

    // Validate all fields
    const newErrors: Record<string, string> = {};
    fields.forEach((field) => {
      const error = validateField(field, formData[field.id]);
      if (error) {
        newErrors[field.id] = error;
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Submit form
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/forms/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          merchantId,
          formName,
          formData,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setSubmitStatus('success');
        setFormData({}); // Reset form
      } else {
        setSubmitStatus('error');
        console.error('Form submission error:', result.error);
      }
    } catch (error) {
      setSubmitStatus('error');
      console.error('Form submission error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (fieldId: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [fieldId]: value }));
    // Clear error for this field when user starts typing
    if (errors[fieldId]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[fieldId];
        return newErrors;
      });
    }
  };

  if (submitStatus === 'success') {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-6 text-center">
        <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-3" />
        <p className="text-green-800 font-medium">{successMessage}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {submitStatus === 'error' && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
          <p className="text-red-800 text-sm">
            Something went wrong. Please try again later.
          </p>
        </div>
      )}

      {fields.map((field) => (
        <div key={field.id} className="space-y-2">
          <Label htmlFor={field.id}>
            {field.label}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </Label>

          {field.type === 'textarea' ? (
            <Textarea
              id={field.id}
              placeholder={field.placeholder}
              value={(formData[field.id] as string) || ''}
              onChange={(e) => handleChange(field.id, e.target.value)}
              className={errors[field.id] ? 'border-red-500' : ''}
              rows={4}
            />
          ) : field.type === 'select' ? (
            <Select
              value={(formData[field.id] as string) || ''}
              onValueChange={(value) => handleChange(field.id, value)}
            >
              <SelectTrigger
                className={errors[field.id] ? 'border-red-500' : ''}
              >
                <SelectValue
                  placeholder={field.placeholder || 'Select an option'}
                />
              </SelectTrigger>
              <SelectContent>
                {field.options?.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : field.type === 'checkbox' ? (
            <div className="flex items-center space-x-2">
              <Checkbox
                id={field.id}
                checked={(formData[field.id] as boolean) || false}
                onCheckedChange={(checked) => handleChange(field.id, checked)}
              />
              <label
                htmlFor={field.id}
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                {field.placeholder || field.label}
              </label>
            </div>
          ) : field.type === 'phone' ? (
            <PhoneInput
              id={field.id}
              placeholder={field.placeholder}
              value={(formData[field.id] as string) || ''}
              onChange={(value) => handleChange(field.id, value)}
              className={errors[field.id] ? 'border-red-500' : ''}
              defaultCountry="NG"
            />
          ) : (
            <Input
              id={field.id}
              type={field.type}
              placeholder={field.placeholder}
              value={(formData[field.id] as string) || ''}
              onChange={(e) => handleChange(field.id, e.target.value)}
              className={errors[field.id] ? 'border-red-500' : ''}
            />
          )}

          {errors[field.id] && (
            <p className="text-sm text-red-500">{errors[field.id]}</p>
          )}
        </div>
      ))}

      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Submitting...
          </>
        ) : (
          submitButtonText
        )}
      </Button>
    </form>
  );
}
