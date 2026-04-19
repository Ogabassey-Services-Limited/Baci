'use client';

const GPT_SCRIPT_SRC = 'https://securepubads.g.doubleclick.net/tag/js/gpt.js';

let googleAdManagerBootPromise: Promise<void> | null = null;
let servicesConfigured = false;
let targetedPath = '/';

export function ensureGoogleTag() {
  window.googletag =
    window.googletag ||
    ({
      cmd: [] as unknown as googletag.CommandArray,
    } as typeof window.googletag);

  return window.googletag;
}

function configureGoogleTagServices(resolve: () => void) {
  const googletag = ensureGoogleTag();

  googletag.cmd.push(() => {
    if (!servicesConfigured) {
      const pubAdsService = googletag.pubads();

      pubAdsService.enableSingleRequest();
      pubAdsService.collapseEmptyDivs();
      googletag.enableServices();
      servicesConfigured = true;
    }

    googletag.pubads().setTargeting('path', targetedPath);
    resolve();
  });
}

export function ensureGoogleAdManagerBoot() {
  if (typeof window === 'undefined') {
    return Promise.resolve();
  }

  const googletag = ensureGoogleTag();

  if (servicesConfigured && typeof googletag.pubads === 'function') {
    return Promise.resolve();
  }

  if (googleAdManagerBootPromise) {
    return googleAdManagerBootPromise;
  }

  googleAdManagerBootPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[src="${GPT_SCRIPT_SRC}"]`
    );

    const configureServices = () => configureGoogleTagServices(resolve);

    if (existingScript) {
      if (
        existingScript.dataset.baciLoaded === 'true' ||
        typeof googletag.pubads === 'function'
      ) {
        configureServices();
        return;
      }

      existingScript.addEventListener(
        'load',
        () => {
          existingScript.dataset.baciLoaded = 'true';
          configureServices();
        },
        { once: true }
      );
      existingScript.addEventListener(
        'error',
        () => reject(new Error('Failed to load Google Publisher Tag')),
        { once: true }
      );
      return;
    }

    const script = document.createElement('script');
    script.src = GPT_SCRIPT_SRC;
    script.async = true;
    script.type = 'text/javascript';
    script.dataset.baciGpt = 'true';
    script.addEventListener(
      'load',
      () => {
        script.dataset.baciLoaded = 'true';
        configureServices();
      },
      { once: true }
    );
    script.addEventListener(
      'error',
      () => reject(new Error('Failed to load Google Publisher Tag')),
      { once: true }
    );
    document.head.appendChild(script);
  }).catch((error) => {
    googleAdManagerBootPromise = null;
    throw error;
  });

  return googleAdManagerBootPromise;
}

export function setGoogleAdManagerPath(pathname?: string | null) {
  if (typeof window === 'undefined') {
    return;
  }

  targetedPath = pathname || '/';

  const googletag = ensureGoogleTag();

  if (!servicesConfigured || typeof googletag.pubads !== 'function') {
    return;
  }

  googletag.cmd.push(() => {
    googletag.pubads().setTargeting('path', targetedPath);
  });
}
