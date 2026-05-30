import {
  findHostElement,
  type TestTreeInstance,
} from '@/test-support/find-host-element';

describe('findHostElement', () => {
  it('returns null for non-object, null, and array values', () => {
    expect(findHostElement(null)).toBeNull();
    expect(findHostElement('text')).toBeNull();
    expect(findHostElement([{ type: 'View' }])).toBeNull();
  });

  it('returns the instance when it is already a host element', () => {
    const host = {
      type: 'Text',
      props: { style: { opacity: 0.5 } },
      children: ['Label'],
    };

    expect(findHostElement(host)).toBe(host);
  });

  it('walks nested composite children until it finds a host element', () => {
    const host = {
      type: 'View',
      props: { accessibilityRole: 'button' },
      children: [],
    };
    const tree: TestTreeInstance = {
      type: function Composite() {
        return null;
      },
      children: [
        'ignored text',
        {
          type: function NestedComposite() {
            return null;
          },
          children: [host],
        },
      ],
    };

    expect(findHostElement(tree)).toBe(host);
  });

  it('returns null when no host child exists', () => {
    const tree: TestTreeInstance = {
      type: function Composite() {
        return null;
      },
      children: [
        {
          type: function NestedComposite() {
            return null;
          },
          children: ['text only'],
        },
      ],
    };

    expect(findHostElement(tree)).toBeNull();
  });
});
