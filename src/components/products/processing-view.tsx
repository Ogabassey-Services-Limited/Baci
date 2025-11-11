
'use client';

import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

const progressSteps = [
  'Connecting to AI model...',
  'Parsing file...',
  'Analyzing product catalog...',
  'Comparing with price list...',
  'Generating change summary...',
  'Finalizing suggestions...'
];

export function ProcessingView() {
    const [currentStep, setCurrentStep] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentStep(prev => (prev + 1) % progressSteps.length);
        }, 1500);

        return () => clearInterval(interval);
    }, []);

    return (
        <div className="flex flex-col items-center justify-center h-full text-center">
            <Loader2 className="w-16 h-16 animate-spin text-primary mb-6" />
            <h2 className="text-2xl font-semibold mb-2">AI is at work...</h2>
            <p className="text-muted-foreground transition-all duration-300">
                {progressSteps[currentStep]}
            </p>
        </div>
    );
}
