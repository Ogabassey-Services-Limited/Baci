import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ImeiCheckerPending } from './imei-checker-pending';

describe('ImeiCheckerPending', () => {
  it('announces an active async check', () => {
    render(<ImeiCheckerPending paused={false} />);

    expect(screen.getByRole('status')).toHaveTextContent(
      /usually under a minute/i
    );
  });

  it('sets expectations after foreground polling pauses', () => {
    render(<ImeiCheckerPending paused />);

    expect(screen.getByRole('status')).toHaveTextContent(/check back later/i);
  });
});
