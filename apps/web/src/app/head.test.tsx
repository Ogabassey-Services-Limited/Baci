import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Head from '@/app/head';

vi.mock('server-only', () => ({}));

afterEach(() => {
  document.body.replaceChildren();
});

describe('Head', () => {
  it('emits the Cloudinary DNS prefetch hint', () => {
    const html = renderToString(<Head />);
    const template = document.createElement('template');
    template.innerHTML = html;
    document.body.append(template.content);

    expect(
      document.querySelector(
        'link[rel="dns-prefetch"][href="https://res.cloudinary.com"]'
      )
    ).toBeInTheDocument();
  });
});
