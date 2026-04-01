'use client';

import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

export function FAQItem({
  question,
  answer,
}: {
  question: string;
  answer: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="group">
      <dt className="mb-3">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          className="flex w-full items-start justify-between text-left glass p-6 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-accent/50 transition-[border-color] duration-200"
        >
          <span className="text-lg font-semibold text-primary dark:text-white pr-4">
            {question}
          </span>
          <ChevronDown
            className={`w-5 h-5 text-accent flex-shrink-0 mt-1 transition-transform duration-300 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </button>
      </dt>
      <dd
        className={`overflow-hidden transition-[max-height,opacity,padding] duration-300 ${
          isOpen ? 'max-h-96 opacity-100 px-6 pb-4' : 'max-h-0 opacity-0'
        }`}
      >
        <p className="text-muted-foreground leading-relaxed pt-2">{answer}</p>
      </dd>
    </div>
  );
}
