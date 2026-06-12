// Required for browser modelContext detection and deferred WebMCP registration.
'use client';

import { useEffect } from 'react';
import type { WebMcpModelContext } from './webmcp-storefront-tools-registration';

type DocumentWithModelContext = Document & {
  modelContext?: WebMcpModelContext;
};

type NavigatorWithModelContext = Navigator & {
  modelContext?: WebMcpModelContext;
};

// Module-scope loader: dynamic import expressions inside the component body
// block React Compiler memoization (BuildHIR Import expression bailout).
function importWebMcpRegistration() {
  return import('./webmcp-storefront-tools-registration');
}

function addModelContext(
  modelContexts: WebMcpModelContext[],
  modelContext: WebMcpModelContext | undefined
): void {
  if (
    modelContext?.registerTool &&
    !modelContexts.some((candidate) => candidate === modelContext)
  ) {
    modelContexts.push(modelContext);
  }
}

function getModelContexts(): WebMcpModelContext[] {
  const modelContexts: WebMcpModelContext[] = [];
  const currentDocument = document as DocumentWithModelContext;
  addModelContext(modelContexts, currentDocument.modelContext);

  const currentNavigator = navigator as NavigatorWithModelContext;
  addModelContext(modelContexts, currentNavigator.modelContext);

  return modelContexts;
}

export function WebMcpStorefrontTools({
  merchantId,
  merchantSlug,
}: {
  merchantId: string;
  merchantSlug: string;
}) {
  useEffect(() => {
    const modelContexts = getModelContexts();
    if (modelContexts.length === 0) {
      return;
    }

    const controller = new AbortController();
    let isActive = true;

    void importWebMcpRegistration()
      .then(({ registerWebMcpStorefrontTools }) => {
        if (!isActive || controller.signal.aborted) {
          return;
        }

        for (const modelContext of modelContexts) {
          registerWebMcpStorefrontTools({
            merchantId,
            merchantSlug,
            modelContext,
            signal: controller.signal,
          });
        }
      })
      .catch((error: unknown) => {
        console.warn('[WebMCP] Failed to initialize storefront tools', {
          error,
        });
      });

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [merchantId, merchantSlug]);

  return null;
}
