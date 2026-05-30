'use client';

import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

const progressSteps = [
  'Connecting to Gemini...',
  'Parsing your file...',
  'Analyzing product catalog...',
  'Comparing with price list...',
  'Generating change summary...',
  'Almost there...',
];

export function ProcessingView() {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev >= progressSteps.length - 1) return prev;
        return prev + 1;
      });
    }, 3000); // 3 seconds per step

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center h-full text-center py-12">
      <Loader2 className="size-16 animate-spin text-primary mb-6" />
      <h2 className="text-2xl font-semibold mb-2">
        AI is analyzing your file…
      </h2>
      <p className="text-muted-foreground transition-all duration-300">
        {progressSteps[currentStep]}
      </p>
      <p className="text-xs text-muted-foreground mt-4">
        This may take 15-30 seconds for large files.
      </p>
    </div>
  );
}
