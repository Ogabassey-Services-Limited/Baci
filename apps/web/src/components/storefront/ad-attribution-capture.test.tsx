// @vitest-environment jsdom
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CLICK_ID_PARAMS } from '@/lib/ad-tracking-cookies';
import {
  AD_ATTRIBUTION_CAPTURE_SCRIPT,
  AdAttributionCapture,
} from './ad-attribution-capture';

describe('AdAttributionCapture (SSR markup)', () => {
  it('renders an inline script into the markup', () => {
    const markup = renderToStaticMarkup(<AdAttributionCapture />);

    expect(markup).toContain('<script>');
    expect(markup).toContain('/api/attr?');
  });

  it('emits the script verbatim (no HTML-escaping of the JS body)', () => {
    const markup = renderToStaticMarkup(<AdAttributionCapture />);

    expect(markup).toContain(AD_ATTRIBUTION_CAPTURE_SCRIPT);
    // Nothing that could break out of the <script> element.
    expect(AD_ATTRIBUTION_CAPTURE_SCRIPT).not.toContain('</script>');
  });

  it('references every known baci_* cookie name', () => {
    for (const cookieName of Object.values(CLICK_ID_PARAMS)) {
      expect(AD_ATTRIBUTION_CAPTURE_SCRIPT).toContain(cookieName);
    }
  });
});

/**
 * Exercises the inline script body itself by evaluating it in jsdom with a
 * controlled `document.prerendering`, `location.search`, `document.cookie`, and
 * a stubbed `fetch`.
 */
describe('AdAttributionCapture (runtime behaviour)', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  function runScript() {
    // Evaluate the component's own trusted inline script string in the jsdom
    // sandbox to exercise its runtime behaviour.
    new Function(AD_ATTRIBUTION_CAPTURE_SCRIPT)();
  }

  function setSearch(search: string) {
    vi.stubGlobal('location', { search });
  }

  function setPrerendering(value: boolean) {
    Object.defineProperty(document, 'prerendering', {
      configurable: true,
      value,
    });
  }

  beforeEach(() => {
    fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal('fetch', fetchMock);
    setPrerendering(false);
    // Reset cookies.
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      writable: true,
      value: '',
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fires a keepalive GET to /api/attr when a click ID is present', () => {
    setSearch('?gclid=abc123');

    runScript();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/attr?gclid=abc123');
    expect(init).toMatchObject({ keepalive: true, credentials: 'same-origin' });
  });

  it('forwards only the click-ID params, dropping utm/other query keys', () => {
    setSearch('?utm_source=google&gclid=abc123&foo=bar');

    runScript();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/attr?gclid=abc123');
  });

  it('URL-encodes forwarded values', () => {
    setSearch('?gclid=a%20b');

    runScript();

    expect(fetchMock.mock.calls[0][0]).toBe('/api/attr?gclid=a%20b');
  });

  it('does not fire when no click IDs are present', () => {
    setSearch('?utm_source=google');

    runScript();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('dedupes: skips a click ID whose baci_* cookie already exists', () => {
    setSearch('?gclid=abc123');
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      writable: true,
      value: 'foo=bar; baci_gclid=already; baz=qux',
    });

    runScript();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('still fires for a new click ID when a different one is already cookied', () => {
    setSearch('?gclid=new&fbclid=fresh');
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      writable: true,
      value: 'baci_gclid=already',
    });

    runScript();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/attr?fbclid=fresh');
  });

  it('does not fire while prerendering, then fires on activation', () => {
    setPrerendering(true);
    setSearch('?gclid=abc123');

    runScript();
    expect(fetchMock).not.toHaveBeenCalled();

    // Activation: prerendering flips false and the event fires.
    setPrerendering(false);
    document.dispatchEvent(new Event('prerenderingchange'));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/attr?gclid=abc123');
  });
});
