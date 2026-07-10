'use client';

import type { ReactNode } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

export interface CategoryHubFaqAccordionItem {
  /**
   * Stable React key. Content-derived (question + answer) rather than index so
   * reordering FAQ items that share a question does not reuse a Radix item's
   * open/closed state for different content.
   */
  reactKey: string;
  /** Radix accordion item value, e.g. `faq-0`. */
  value: string;
  question: string;
  /**
   * Pre-rendered answer node — a server-rendered `<SafeHtml>` element. Passing
   * it as a ReactNode slot keeps `sanitize-html` (254 KB) in the server graph;
   * this client shell only owns the accordion open/close state machine.
   */
  answer: ReactNode;
}

interface CategoryHubFaqAccordionProps {
  items: CategoryHubFaqAccordionItem[];
}

/**
 * Thin client interactive shell for the category-hub FAQ. The sanitized answer
 * content is composed on the server and injected here as `children`, so this is
 * the only part of the FAQ that ships to the client (the Radix accordion).
 */
export function CategoryHubFaqAccordion({
  items,
}: CategoryHubFaqAccordionProps) {
  return (
    <Accordion type="single" collapsible className="w-full">
      {items.map((item) => (
        <AccordionItem
          key={item.reactKey}
          value={item.value}
          className="border-b border-store-background-text/10"
        >
          <AccordionTrigger className="py-3 text-left text-sm font-semibold text-store-background-text/80 hover:text-store-primary hover:no-underline">
            {item.question}
          </AccordionTrigger>
          <AccordionContent className="text-sm leading-7 text-store-background-text/70">
            {item.answer}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
