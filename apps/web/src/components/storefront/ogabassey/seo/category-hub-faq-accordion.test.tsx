import { render, screen } from '@testing-library/react';
import { type ReactNode, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  CategoryHubFaqAccordion,
  type CategoryHubFaqAccordionItem,
} from './category-hub-faq-accordion';

// Mock the Radix accordion primitive. AccordionItem snapshots its children on
// first mount (mirroring Radix's internal per-item state) so we can assert that
// content-derived keys avoid stale state when items reorder.
vi.mock('@/components/ui/accordion', () => ({
  Accordion: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AccordionContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  AccordionItem: ({ children }: { children: ReactNode }) => {
    const [initialChildren] = useState(children);
    return <div>{initialChildren}</div>;
  },
  AccordionTrigger: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}));

function buildItems(): CategoryHubFaqAccordionItem[] {
  return [
    {
      reactKey: 'q1-a1',
      value: 'faq-0',
      question: 'What matters most?',
      answer: <p>Battery, camera, and storage.</p>,
    },
    {
      reactKey: 'q2-a2',
      value: 'faq-1',
      question: 'Do you deliver nationwide?',
      answer: <span>Yes, across Nigeria.</span>,
    },
  ];
}

describe('CategoryHubFaqAccordion', () => {
  it('renders each question with its pre-rendered answer node', () => {
    render(<CategoryHubFaqAccordion items={buildItems()} />);

    expect(screen.getByText('What matters most?')).toBeInTheDocument();
    expect(
      screen.getByText('Battery, camera, and storage.')
    ).toBeInTheDocument();
    expect(screen.getByText('Do you deliver nationwide?')).toBeInTheDocument();
    expect(screen.getByText('Yes, across Nigeria.')).toBeInTheDocument();
  });

  it('renders nothing meaningful when there are no items', () => {
    const { container } = render(<CategoryHubFaqAccordion items={[]} />);

    expect(container.querySelector('p')).toBeNull();
    expect(screen.queryByText(/deliver/i)).not.toBeInTheDocument();
  });

  it('keeps answer content aligned with its question after a reorder', () => {
    const first: CategoryHubFaqAccordionItem[] = [
      {
        reactKey: 'same-battery',
        value: 'faq-0',
        question: 'What matters most?',
        answer: <p>Battery.</p>,
      },
      {
        reactKey: 'same-camera',
        value: 'faq-1',
        question: 'What matters most?',
        answer: <p>Camera.</p>,
      },
    ];

    const { rerender } = render(<CategoryHubFaqAccordion items={first} />);

    expect(
      screen.getAllByText(/Battery\.|Camera\./).map((node) => node.textContent)
    ).toEqual(['Battery.', 'Camera.']);

    rerender(
      <CategoryHubFaqAccordion items={[first[1], first[0]] as typeof first} />
    );

    // Content-derived keys move with their content, so the reordered array
    // renders Camera before Battery instead of reusing stale item state.
    expect(
      screen.getAllByText(/Battery\.|Camera\./).map((node) => node.textContent)
    ).toEqual(['Camera.', 'Battery.']);
  });
});
