'use client';

import { Github, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SubmissionType = 'github' | 'zip';

interface SubmissionMethodToggleProps {
  onChange: (value: SubmissionType) => void;
  value: SubmissionType;
}

const SUBMISSION_METHODS: Array<{
  icon: typeof Github;
  label: string;
  value: SubmissionType;
}> = [
  {
    icon: Github,
    label: 'GitHub Repository',
    value: 'github',
  },
  {
    icon: Upload,
    label: 'Upload Zip Archive',
    value: 'zip',
  },
];

export function SubmissionMethodToggle({
  onChange,
  value,
}: SubmissionMethodToggleProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {SUBMISSION_METHODS.map((method) => {
        const Icon = method.icon;
        const isSelected = value === method.value;

        return (
          <button
            key={method.value}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onChange(method.value)}
            className={cn(
              'flex items-center justify-center p-4 border rounded-xl transition-all duration-200',
              isSelected
                ? 'border-blue-600 bg-blue-50/50 text-blue-700 ring-1 ring-blue-600'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            )}
          >
            <Icon className="size-5 mr-3" />
            <span className="font-medium">{method.label}</span>
          </button>
        );
      })}
    </div>
  );
}
