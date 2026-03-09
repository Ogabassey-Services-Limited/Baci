import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ChatMessage as ChatMessageType } from './types';

// SafeHtml uses sanitizeHtml — pass-through so rendered HTML content is
// directly queryable in tests
vi.mock('@/lib/sanitize', () => ({
  sanitizeHtml: vi.fn((s: string) => s),
}));

// next/image is already stubbed globally in vitest.setup.ts but an explicit
// mock here keeps the test file self-contained and makes the src queryable
vi.mock('next/image', () => ({
  default: ({
    src,
    alt,
    ...rest
  }: {
    src: string;
    alt: string;
    [key: string]: unknown;
  }) => (
    // biome-ignore lint/performance/noImgElement: test mock for next/image
    <img src={src} alt={alt} {...rest} />
  ),
}));

import { ChatMessage } from './chat-message';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildMessage(
  overrides: Partial<ChatMessageType> = {}
): ChatMessageType {
  return {
    role: 'user',
    content: 'Hello there!',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Basic rendering
// ---------------------------------------------------------------------------

describe('ChatMessage — rendering', () => {
  it('renders plain text content for a user message', () => {
    render(<ChatMessage message={buildMessage({ content: 'Hello there!' })} />);

    expect(screen.getByText('Hello there!')).toBeInTheDocument();
  });

  it('renders plain text content for an assistant message', () => {
    render(
      <ChatMessage
        message={buildMessage({ role: 'assistant', content: 'Ho ho ho!' })}
      />
    );

    expect(screen.getByText('Ho ho ho!')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Markdown rendering (SimpleMarkdownRenderer)
// ---------------------------------------------------------------------------

describe('ChatMessage — markdown rendering', () => {
  it('renders bold text from **markdown**', () => {
    render(
      <ChatMessage
        message={buildMessage({ role: 'assistant', content: '**Bold text**' })}
      />
    );

    const strong = screen.getByText('Bold text');
    expect(strong.tagName).toBe('STRONG');
  });

  it('renders italic text from *markdown*', () => {
    render(
      <ChatMessage
        message={buildMessage({ role: 'assistant', content: '*Italic text*' })}
      />
    );

    const em = screen.getByText('Italic text');
    expect(em.tagName).toBe('EM');
  });

  it('renders a link from [text](url) markdown', () => {
    render(
      <ChatMessage
        message={buildMessage({
          role: 'assistant',
          content: '[Visit Santa](https://example.com)',
        })}
      />
    );

    const link = screen.getByRole('link', { name: 'Visit Santa' });
    expect(link).toHaveAttribute('href', 'https://example.com');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });
});

// ---------------------------------------------------------------------------
// User vs assistant message alignment and color
// ---------------------------------------------------------------------------

describe('ChatMessage — user vs assistant styling', () => {
  it('aligns assistant messages to the start (flex justify-start)', () => {
    const { container } = render(
      <ChatMessage
        message={buildMessage({ role: 'assistant', content: 'Hi!' })}
      />
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('justify-start');
    expect(wrapper.className).not.toContain('justify-end');
  });

  it('aligns user messages to the end (flex justify-end)', () => {
    const { container } = render(
      <ChatMessage message={buildMessage({ role: 'user', content: 'Hi!' })} />
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('justify-end');
    expect(wrapper.className).not.toContain('justify-start');
  });

  it('applies red background to assistant message bubble', () => {
    const { container } = render(
      <ChatMessage
        message={buildMessage({ role: 'assistant', content: 'Hello' })}
      />
    );

    const bubbleEl = Array.from(container.querySelectorAll('div')).find((el) =>
      el.className.includes('bg-red-100')
    );
    expect(bubbleEl).toBeTruthy();
  });

  it('applies gray background to user message bubble', () => {
    const { container } = render(
      <ChatMessage message={buildMessage({ role: 'user', content: 'Hello' })} />
    );

    const bubbleEl = Array.from(container.querySelectorAll('div')).find((el) =>
      el.className.includes('bg-gray-200')
    );
    expect(bubbleEl).toBeTruthy();
  });

  it('renders the Santa avatar image for assistant messages', () => {
    render(
      <ChatMessage
        message={buildMessage({ role: 'assistant', content: 'Hi!' })}
      />
    );

    const avatar = screen.getByAltText('Santa Claus');
    expect(avatar).toBeInTheDocument();
  });

  it('does not render the Santa avatar image for user messages', () => {
    render(
      <ChatMessage message={buildMessage({ role: 'user', content: 'Hi!' })} />
    );

    expect(screen.queryByAltText('Santa Claus')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Image message rendering
// ---------------------------------------------------------------------------

describe('ChatMessage — image messages', () => {
  it('renders a data URL image when imageUrl is a data URI', () => {
    const dataUrl = 'data:image/png;base64,abc123';
    render(
      <ChatMessage
        message={buildMessage({ role: 'user', imageUrl: dataUrl })}
      />
    );

    const img = screen.getByAltText('User upload');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', dataUrl);
  });

  it('renders an https image when imageUrl starts with https://', () => {
    const httpsUrl = 'https://example.com/photo.jpg';
    render(
      <ChatMessage
        message={buildMessage({ role: 'user', imageUrl: httpsUrl })}
      />
    );

    const img = screen.getByAltText('User upload');
    expect(img).toHaveAttribute('src', httpsUrl);
  });

  it('renders an [Invalid Image] error span for non-data, non-https URLs', () => {
    render(
      <ChatMessage
        message={buildMessage({ role: 'user', imageUrl: 'ftp://bad.url/img' })}
      />
    );

    expect(screen.getByText('[Invalid Image]')).toBeInTheDocument();
    expect(screen.queryByAltText('User upload')).not.toBeInTheDocument();
  });

  it('renders text content (not an image) when imageUrl is absent', () => {
    render(
      <ChatMessage
        message={buildMessage({ role: 'user', content: 'Just text' })}
      />
    );

    expect(screen.getByText('Just text')).toBeInTheDocument();
    expect(screen.queryByAltText('User upload')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('ChatMessage — edge cases', () => {
  it('renders an empty message without crashing', () => {
    const { container } = render(
      <ChatMessage message={buildMessage({ content: '' })} />
    );

    expect(container.firstChild).toBeInTheDocument();
  });

  it('renders a long message without truncating content', () => {
    const longText = 'word '.repeat(200).trim();
    render(<ChatMessage message={buildMessage({ content: longText })} />);

    // The text should be present in the DOM (may be split by <br/> elements,
    // so check for a substring that would appear in at least one text node)
    expect(screen.getByText(/word word word/)).toBeInTheDocument();
  });
});
