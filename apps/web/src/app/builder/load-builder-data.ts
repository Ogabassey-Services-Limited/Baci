import type { Data } from '@puckeditor/core';
import type { Dispatch, SetStateAction } from 'react';
import type { SEOData } from '@/components/builder/seo-panel';
import type { SetupSettings } from '@/components/builder/setup-panel';
import type { StoreSettings } from '@/components/builder/store-settings-panel';
import { defaultTheme, type ThemeConfiguration } from '@/lib/theme-config';
import { applyTheme } from '@/lib/theme-manager';
import type { BuilderLoadResponse } from '@/types/builder';
import type {
  BuilderDataSetters,
  BuilderRouter,
  BuilderSessionSetters,
  BuilderToast,
} from './builder-client-types';
import { createDefaultBuilderSettings } from './builder-default-settings';
import { getDegradedBuilderDescription } from './builder-descriptions';

const BUILDER_BOOTSTRAP_TIMEOUT_MS = 15_000;

interface LoadBuilderDataParams
  extends BuilderSessionSetters,
    BuilderDataSetters {
  router: BuilderRouter;
  merchantId: string;
  signal?: AbortSignal;
  toast: BuilderToast;
  setPageLoading: Dispatch<SetStateAction<boolean>>;
}

function getBuilderBootstrapUrl(merchantId: string) {
  if (typeof window === 'undefined') {
    return `/api/builder?slug=home&merchantId=${encodeURIComponent(merchantId)}`;
  }

  const url = new URL('/api/builder', window.location.origin);
  url.searchParams.set('slug', 'home');
  url.searchParams.set('merchantId', merchantId);

  const aiDraftJobId = new URLSearchParams(window.location.search).get(
    'aiDraftJobId'
  );
  if (aiDraftJobId) {
    url.searchParams.set('aiDraftJobId', aiDraftJobId);
  }

  return url.toString();
}

function getDefaultBuilderData() {
  return {
    content: [],
    root: { title: 'Home' },
    zones: {},
    theme: defaultTheme,
  } satisfies Data & { theme: ThemeConfiguration };
}

function applyLoadedBuilderData({
  json,
  setData,
  setSeoData,
  setStoreSettings,
  setSetupSettings,
  setLastUpdated,
  setCanEdit,
  setDegradedReason,
  setPreviewMode,
  setAiDraftJobId,
  setCanApplyAiDraft,
}: BuilderDataSetters & BuilderSessionSetters & { json: BuilderLoadResponse }) {
  const defaultSettings = createDefaultBuilderSettings();

  setData(json.config as Data);
  setLastUpdated(json.lastUpdated);
  setCanEdit(json.canEdit);
  setDegradedReason(json.degradedReason);
  setPreviewMode(json.previewMode);
  setAiDraftJobId(json.aiDraftJobId);
  setCanApplyAiDraft(json.canApplyAiDraft);

  if (json.seo) {
    setSeoData(json.seo as SEOData);
  } else {
    setSeoData({
      title: json.config?.root?.title || 'Home',
      description: '',
      keywords: '',
      twitterCard: 'summary_large_image',
    });
  }

  setStoreSettings(
    (json.storeSettings as StoreSettings | null) ??
      defaultSettings.storeSettings
  );
  setSetupSettings(
    (json.setupSettings as SetupSettings | null) ??
      defaultSettings.setupSettings
  );

  if (json.config?.theme) {
    applyTheme(json.config.theme as ThemeConfiguration);
  } else {
    applyTheme(defaultTheme);
  }
}

function applyFallbackBuilderData(
  {
    setData,
    setStoreSettings,
    setSetupSettings,
  }: Pick<
    BuilderDataSetters,
    'setData' | 'setStoreSettings' | 'setSetupSettings'
  >,
  markReadOnly: BuilderSessionSetters | null = null
) {
  const defaultData = getDefaultBuilderData();
  const defaultSettings = createDefaultBuilderSettings();
  setData(defaultData);
  setStoreSettings(defaultSettings.storeSettings);
  setSetupSettings(defaultSettings.setupSettings);
  applyTheme(defaultData.theme);

  if (markReadOnly) {
    markReadOnly.setLastUpdated(null);
    markReadOnly.setCanEdit(false);
    markReadOnly.setDegradedReason('config_load_failed');
    markReadOnly.setPreviewMode(null);
    markReadOnly.setAiDraftJobId(null);
    markReadOnly.setCanApplyAiDraft(false);
  }
}

function getBuilderBootstrapSignal(signal?: AbortSignal) {
  const timeoutSignal = AbortSignal.timeout(BUILDER_BOOTSTRAP_TIMEOUT_MS);

  if (!signal) {
    return timeoutSignal;
  }

  if (signal.aborted) {
    return signal;
  }

  if (typeof AbortSignal.any === 'function') {
    return AbortSignal.any([signal, timeoutSignal]);
  }

  const controller = new AbortController();
  const abortFrom = (source: AbortSignal) => {
    if (!controller.signal.aborted) {
      controller.abort(source.reason);
    }
  };

  for (const source of [signal, timeoutSignal]) {
    if (source.aborted) {
      abortFrom(source);
      break;
    }
    source.addEventListener('abort', () => abortFrom(source), { once: true });
  }

  return controller.signal;
}

export async function loadBuilderData(params: LoadBuilderDataParams) {
  const {
    router,
    merchantId,
    signal,
    toast,
    setData,
    setSeoData,
    setStoreSettings,
    setSetupSettings,
    setPageLoading,
    setLastUpdated,
    setCanEdit,
    setDegradedReason,
    setPreviewMode,
    setAiDraftJobId,
    setCanApplyAiDraft,
  } = params;

  try {
    const res = await fetch(getBuilderBootstrapUrl(merchantId), {
      signal: getBuilderBootstrapSignal(signal),
    });

    if (signal?.aborted) {
      return;
    }

    if (!res.ok) {
      if (res.status === 401) {
        router.push('/login');
        return;
      }
      throw new Error(`API error: ${res.status}`);
    }

    const json = (await res.json()) as BuilderLoadResponse;

    if (signal?.aborted) {
      return;
    }

    if (json.config) {
      applyLoadedBuilderData({
        json,
        setData,
        setSeoData,
        setStoreSettings,
        setSetupSettings,
        setLastUpdated,
        setCanEdit,
        setDegradedReason,
        setPreviewMode,
        setAiDraftJobId,
        setCanApplyAiDraft,
      });

      if (json.degraded) {
        toast({
          title: 'Builder opened in read-only mode',
          description: getDegradedBuilderDescription(json.degradedReason),
          variant: 'destructive',
        });
      } else if (json.previewMode === 'ai_draft') {
        toast({
          title: 'AI draft preview',
          description:
            'Review the generated storefront before applying it to your draft.',
        });
      } else if (json.isDefault) {
        toast({
          title: 'Starting from your template',
          description:
            "We've loaded your current storefront as a starting point. Customize it to make it your own!",
        });
      }
    } else {
      applyFallbackBuilderData({ setData, setStoreSettings, setSetupSettings });
    }
  } catch (error) {
    if (signal?.aborted) {
      return;
    }

    console.error('Failed to load builder data:', error);
    toast({
      title: 'Error',
      description: 'Failed to load page configuration. Using default template.',
      variant: 'destructive',
    });
    applyFallbackBuilderData(
      { setData, setStoreSettings, setSetupSettings },
      {
        setLastUpdated,
        setCanEdit,
        setDegradedReason,
        setPreviewMode,
        setAiDraftJobId,
        setCanApplyAiDraft,
      }
    );
  } finally {
    if (!signal?.aborted) {
      setPageLoading(false);
    }
  }
}
