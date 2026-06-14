export interface KlumpCheckoutConfig {
  publicKey: string;
  data: {
    amount: number;
    currency: 'NGN';
    email?: string;
    first_name?: string;
    last_name?: string;
    phone?: string;
    merchant_reference: string;
    redirect_url: string;
    items: Array<{
      name: string;
      quantity: number;
      unit_price: number;
    }>;
    meta_data: {
      order_id: string;
      source: 'baci-web';
    };
  };
  onSuccess?: (payload?: unknown) => void;
  onError?: (error: unknown) => void;
  onClose?: () => void;
  onLoad?: () => void;
  onOpen?: () => void;
}

export type KlumpConstructor = new (config: KlumpCheckoutConfig) => unknown;

const KLUMP_SCRIPT_URL = 'https://js.useklump.com/klump.js';
let klumpScriptLoadPromise: Promise<void> | null = null;

declare global {
  interface Window {
    Klump?: KlumpConstructor;
  }
}

declare const Klump: KlumpConstructor | undefined;

export function getKlumpPublicKey() {
  const key =
    process.env.NEXT_PUBLIC_KLUMP_PUBLIC_KEY ||
    process.env.NEXT_PUBLIC_KLUMP_KEY ||
    process.env.KLUMP_PUBLIC_KEY;

  if (!key) {
    throw new Error(
      'NEXT_PUBLIC_KLUMP_PUBLIC_KEY (or NEXT_PUBLIC_KLUMP_KEY) is not set'
    );
  }

  return key;
}

function exposeKlumpConstructorOnWindow() {
  if (typeof window.Klump === 'function') {
    return;
  }

  try {
    const bridgeScript = document.createElement('script');
    bridgeScript.textContent =
      'window.Klump = typeof Klump === "function" ? Klump : window.Klump;';
    document.head.appendChild(bridgeScript);
    bridgeScript.remove();
  } catch {
    // Fall through and let the caller surface the normal SDK-load error.
  }
}

export function getKlumpConstructor() {
  if (typeof window.Klump === 'function') {
    return window.Klump;
  }

  exposeKlumpConstructorOnWindow();
  if (typeof window.Klump === 'function') {
    return window.Klump;
  }

  if (typeof Klump === 'function') {
    return Klump;
  }

  return null;
}

export function loadKlumpSdk() {
  if (typeof window === 'undefined') {
    return Promise.resolve();
  }

  if (getKlumpConstructor()) {
    return Promise.resolve();
  }

  if (klumpScriptLoadPromise) {
    return klumpScriptLoadPromise;
  }

  klumpScriptLoadPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = KLUMP_SCRIPT_URL;
    script.async = true;

    script.addEventListener('load', () => {
      exposeKlumpConstructorOnWindow();
      if (getKlumpConstructor()) {
        resolve();
        return;
      }

      klumpScriptLoadPromise = null;
      reject(new Error('Klump SDK failed to load'));
    });

    script.addEventListener('error', () => {
      klumpScriptLoadPromise = null;
      reject(new Error('Failed to load Klump script'));
    });

    document.head.appendChild(script);
  });

  return klumpScriptLoadPromise;
}

export function resetKlumpSdkLoadForTests() {
  klumpScriptLoadPromise = null;
}
