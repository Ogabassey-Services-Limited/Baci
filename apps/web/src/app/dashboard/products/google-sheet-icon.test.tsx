import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GoogleSheetIcon } from './google-sheet-icon';

describe('GoogleSheetIcon', () => {
  it('renders the expected svg structure and classes', () => {
    const { container } = render(<GoogleSheetIcon className="custom-class" />);

    const svg = container.querySelector('svg');

    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute('viewBox', '0 0 24 24');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveClass('h-3.5', 'w-3.5', 'text-green-600', 'custom-class');
    expect(container.querySelectorAll('path')).not.toHaveLength(0);
    expect(container.querySelectorAll('polyline')).toHaveLength(1);
  });
});
