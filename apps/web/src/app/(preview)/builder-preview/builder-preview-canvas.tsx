'use client';

import {
  type BuilderPreviewResponse,
  builderDesignCapabilities,
  builderPreviewResponseSchema,
} from '@baci/shared/contracts';
import { useEffect, useState } from 'react';
import { RenderBuilderConfig } from '@/components/storefront/render-builder-config';
import { parseBuilderPreviewEvent } from './parse-builder-preview-event';

type PreviewState = {
  config: Parameters<typeof RenderBuilderConfig>[0]['config'];
  merchantContext: Parameters<typeof RenderBuilderConfig>[0]['merchantContext'];
  revision: number;
};

type NativePreviewBridge = {
  postMessage: (message: string) => void;
};

function postPreviewResponse(response: BuilderPreviewResponse): void {
  const parsed = builderPreviewResponseSchema.safeParse(response);
  if (!parsed.success) return;
  const message = JSON.stringify(parsed.data);
  const nativeBridge = (
    window as Window & {
      ReactNativeWebView?: NativePreviewBridge;
    }
  ).ReactNativeWebView;
  nativeBridge?.postMessage(message);
  if (window.parent !== window) window.parent.postMessage(message, '*');
}

export function BuilderPreviewCanvas() {
  const [preview, setPreview] = useState<PreviewState | null>(null);

  useEffect(() => {
    postPreviewResponse({
      capabilityHash: builderDesignCapabilities.capabilityHash,
      capabilityVersion: builderDesignCapabilities.capabilityVersion,
      type: 'baci.builder-preview.ready',
      version: 1,
    });

    const receivePreview = (event: MessageEvent<unknown>) => {
      const message = parseBuilderPreviewEvent(event);
      if (!message) {
        postPreviewResponse({
          code: 'invalid_message',
          type: 'baci.builder-preview.error',
          version: 1,
        });
        return;
      }
      setPreview((current) => {
        if (current && message.revision <= current.revision) return current;
        postPreviewResponse({
          revision: message.revision,
          type: 'baci.builder-preview.rendered',
          version: 1,
        });
        return {
          config: message.candidateConfig,
          merchantContext: {
            basePath: message.merchant.basePath ?? `/${message.merchant.slug}`,
            id: message.merchant.id,
            slug: message.merchant.slug,
          },
          revision: message.revision,
        };
      });
    };

    window.addEventListener('message', receivePreview);
    return () => window.removeEventListener('message', receivePreview);
  }, []);

  if (!preview) return null;
  return (
    <RenderBuilderConfig
      config={preview.config}
      merchantContext={preview.merchantContext}
    />
  );
}
