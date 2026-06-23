import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SemanticSectionsErrorBoundary } from './semantic-sections-error-boundary';

function Boom(): never {
  throw new Error('transient SEO-data failure');
}

describe('SemanticSectionsErrorBoundary', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders children when they do not throw', () => {
    render(
      <SemanticSectionsErrorBoundary fallback={<span>fallback</span>}>
        <p>semantic links</p>
      </SemanticSectionsErrorBoundary>
    );

    expect(screen.getByText('semantic links')).toBeInTheDocument();
    expect(screen.queryByText('fallback')).not.toBeInTheDocument();
  });

  it('renders the fallback and logs the error when a child throws (cold-cache transient failure)', () => {
    // React logs the caught error; silence it for a clean test run.
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <SemanticSectionsErrorBoundary fallback={<span>fallback</span>}>
        <Boom />
      </SemanticSectionsErrorBoundary>
    );

    expect(screen.getByText('fallback')).toBeInTheDocument();
    // componentDidCatch logs the degradation for observability.
    expect(errorSpy).toHaveBeenCalledWith(
      'SemanticSectionsErrorBoundary caught an error:',
      expect.any(Error),
      expect.anything()
    );
  });

  it('renders nothing by default when a child throws and no fallback is given', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const { container } = render(
      <SemanticSectionsErrorBoundary>
        <Boom />
      </SemanticSectionsErrorBoundary>
    );

    expect(container).toBeEmptyDOMElement();
  });
});
