import { describe, expect, it } from 'vitest';
import { getBlogStatusToast } from './blog-status-toast';

describe('getBlogStatusToast', () => {
  it.each([
    ['published', 'Post Published', 'published'],
    ['archived', 'Post Archived', 'archived'],
    ['draft', 'Post Unpublished', 'moved to drafts'],
  ] as const)('describes the %s transition', (status, title, description) => {
    expect(getBlogStatusToast(status)).toEqual({
      description: `The blog post has been ${description}.`,
      title,
    });
  });
});
