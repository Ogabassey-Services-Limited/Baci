'use client';

import { CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface SubmitTemplateSuccessStateProps {
  onReturn: () => void;
}

const successAccentStyles = {
  backgroundColor:
    'color-mix(in srgb, var(--store-primary, #16a34a) 12%, transparent)',
  color: 'var(--store-primary, #16a34a)',
};

const successCardStyles = {
  borderColor:
    'color-mix(in srgb, var(--store-primary, #16a34a) 18%, transparent)',
};

export function SubmitTemplateSuccessState({
  onReturn,
}: SubmitTemplateSuccessStateProps) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card
        className="max-w-md w-full text-center p-8 shadow-xl"
        style={successCardStyles}
      >
        <div
          className="mx-auto size-16 rounded-full flex items-center justify-center mb-6"
          style={successAccentStyles}
        >
          <CheckCircle className="size-8" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Submission Successful!
        </h2>
        <p className="text-gray-500 mb-8">
          Thank you for contributing to the Baci ecosystem. Your template is now
          in our review queue.
        </p>
        <Button onClick={onReturn} className="w-full">
          Return to Gallery
        </Button>
      </Card>
    </div>
  );
}
