import { describe, expect, it } from 'vitest';
import { parseGoogleMerchantProductSampleStream } from '@/lib/agentic/agent-commerce-public-product-parity-google-feed';

const ITEM = `<item>
  <g:id>product-1</g:id>
  <g:title>Test Phone</g:title>
  <g:link>https://ogabassey.com/phones/test-phone</g:link>
  <g:image_link>https://cdn.example.com/phone.jpg</g:image_link>
  <g:availability>in_stock</g:availability>
  <g:price>1000.00 NGN</g:price>
</item>`;

describe('parseGoogleMerchantProductSampleStream', () => {
  it('parses a selected item split across XML stream chunks', async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            '<rss xmlns:g="http://base.google.com/ns/1.0"><channel><item><g:id>unrelated</g:id></item>'
          )
        );
        controller.enqueue(encoder.encode(ITEM.slice(0, 72)));
        controller.enqueue(encoder.encode(`${ITEM.slice(72)}</channel></rss>`));
        controller.close();
      },
    });

    await expect(
      parseGoogleMerchantProductSampleStream(stream, 'product-1')
    ).resolves.toEqual({
      availability: 'in_stock',
      image: 'https://cdn.example.com/phone.jpg',
      name: 'Test Phone',
      price: 1000,
      url: 'https://ogabassey.com/phones/test-phone',
    });
  });

  it('skips an oversized unrelated XML item and continues scanning', async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            `<rss><channel><item><g:id>unrelated</g:id><g:description>${'x'.repeat(600_000)}`
          )
        );
        controller.enqueue(encoder.encode('x'.repeat(600_000)));
        controller.enqueue(
          encoder.encode(`</g:description></item>${ITEM}</channel></rss>`)
        );
        controller.close();
      },
    });

    await expect(
      parseGoogleMerchantProductSampleStream(stream, 'product-1')
    ).resolves.toMatchObject({ name: 'Test Phone', price: 1000 });
  });
});
