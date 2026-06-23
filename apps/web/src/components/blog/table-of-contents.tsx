'use client';

import { List } from 'lucide-react';
import { useEffect, useState } from 'react';

interface TocItem {
  id: string;
  text: string;
  level: number;
}

function collectHeadings(setHeadings: (items: TocItem[]) => void): void {
  const container = document.querySelector('.blog-content-renderer');
  if (!container) return;

  const elements = container.querySelectorAll('h2[id], h3[id], h4[id]');
  const items: TocItem[] = Array.from(elements).map((el) => ({
    id: el.id,
    text: el.textContent || '',
    level: Number(el.tagName[1]),
  }));
  setHeadings(items);
}

function getHeadingIndentClass(level: number): string {
  if (level >= 4) {
    return 'pl-8';
  }

  if (level === 3) {
    return 'pl-4';
  }

  return '';
}

export function TableOfContents() {
  const [headings, setHeadings] = useState<TocItem[]>([]);
  const [activeId, setActiveId] = useState('');

  useEffect(() => {
    collectHeadings(setHeadings);
  }, []);

  useEffect(() => {
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: '-80px 0px -60% 0px' }
    );

    for (const { id } of headings) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [headings]);

  if (headings.length < 3) return null;

  return (
    <nav
      aria-label="Table of contents"
      className="mb-8 p-4 bg-muted/50 rounded-lg border border-border/50"
    >
      <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-foreground">
        <List className="size-4" />
        In this article
      </div>
      <ul className="space-y-1.5">
        {headings.map((heading) => (
          <li key={heading.id}>
            <a
              href={`#${heading.id}`}
              className={`block text-sm transition-colors hover:text-foreground ${getHeadingIndentClass(
                heading.level
              )} ${
                activeId === heading.id
                  ? 'text-primary font-medium'
                  : 'text-muted-foreground'
              }`}
            >
              {heading.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
