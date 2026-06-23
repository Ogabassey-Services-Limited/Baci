'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface SemanticSectionsErrorBoundaryProps {
  children: ReactNode;
  /** Rendered if the semantic sections throw (e.g. transient SEO-data failure). */
  fallback?: ReactNode;
}

interface SemanticSectionsErrorBoundaryState {
  hasError: boolean;
}

/**
 * Degrades the PDP semantic SEO sections to a fallback (default: nothing) when
 * their data unit throws on a transient failure with a cold cache. Pairs with
 * the strict `getCachedProductSeoLinkData` unit: a throw there means "no
 * last-good value to serve," so we render the PDP without the semantic links
 * rather than failing the whole route. A warm cache serves last-good and never
 * reaches this boundary.
 */
export class SemanticSectionsErrorBoundary extends Component<
  SemanticSectionsErrorBoundaryProps,
  SemanticSectionsErrorBoundaryState
> {
  state: SemanticSectionsErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): SemanticSectionsErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Surface the (rare) cold-cache transient degradation for observability —
    // otherwise the PDP silently drops its semantic SEO links with no signal.
    console.error(
      'SemanticSectionsErrorBoundary caught an error:',
      error,
      errorInfo.componentStack
    );
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? null;
    }
    return this.props.children;
  }
}
