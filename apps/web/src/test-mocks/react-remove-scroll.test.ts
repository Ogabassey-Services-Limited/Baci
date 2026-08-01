import { describe, expect, it } from 'vitest';
import { RemoveScroll } from './react-remove-scroll';

describe('react-remove-scroll test adapter', () => {
  it('keeps modal children intact', () => {
    const element = RemoveScroll({ children: 'content' });

    expect(element.props.children).toBe('content');
  });
});
