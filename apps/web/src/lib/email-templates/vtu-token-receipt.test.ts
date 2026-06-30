import { describe, expect, it } from 'vitest';
import { generateVtuTokenReceiptEmail } from './vtu-token-receipt';
import { generateVtuTokenReceiptText } from './vtu-token-receipt-text';

describe('VTU token receipt email', () => {
  it('escapes receipt fields and rejects unsafe merchant links', () => {
    const html = generateVtuTokenReceiptEmail({
      transactionId: 'tx-1',
      reference: 'REF-<script>alert(1)</script>',
      customerName: 'Ada <img src=x onerror=alert(1)>',
      amount: 2500,
      type: 'electricity',
      providerLabel: 'EKEDC <b>bad</b>',
      customerIdentifier: 'METER-<script>meter()</script>',
      voucherPin: 'PIN-<script>token()</script>',
      phone_number: '080<script>phone()</script>',
      merchantName: 'Shop <script>brand()</script>',
      merchantUrl: 'javascript:alert(1)',
      supportEmail: 'help@example.com<script>alert(1)</script>',
      merchantTin: 'TIN-<script>tin()</script>',
      merchantRcNumber: 'RC-<script>rc()</script>',
    });

    expect(html).toContain('Ada &lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('EKEDC &lt;b&gt;bad&lt;/b&gt;');
    expect(html).toContain('METER-&lt;script&gt;meter()&lt;/script&gt;');
    expect(html).toContain('PIN-&lt;script&gt;token()&lt;/script&gt;');
    expect(html).toContain('href="#"');
    expect(html).toContain('RC: RC-&lt;script&gt;rc()&lt;/script&gt;');
    expect(html).toContain('TIN: TIN-&lt;script&gt;tin()&lt;/script&gt;');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('javascript:alert(1)');
  });

  it('renders the meter address (escaped) in HTML and text when provided', () => {
    const data = {
      transactionId: 'tx-addr',
      reference: 'REF-1',
      customerName: 'Meter Owner',
      amount: 2000,
      type: 'electricity' as const,
      providerLabel: 'EKEDC',
      customerIdentifier: '43901766923',
      address: '5 Marina Rd <script>x()</script>',
      voucherPin: '1234-5678',
      merchantName: 'Shop',
      merchantUrl: 'https://shop.example.com',
    };

    const html = generateVtuTokenReceiptEmail(data);
    const text = generateVtuTokenReceiptText(data);

    expect(html).toContain('Address');
    expect(html).toContain('5 Marina Rd &lt;script&gt;x()&lt;/script&gt;');
    expect(html).not.toContain('<script>x()');
    expect(text).toContain('- Address: 5 Marina Rd');
    expect(text).not.toContain('<script>');
  });

  it('omits the address row when no address is supplied', () => {
    const html = generateVtuTokenReceiptEmail({
      transactionId: 'tx-noaddr',
      reference: 'REF-2',
      customerName: 'Meter Owner',
      amount: 2000,
      type: 'electricity',
      providerLabel: 'EKEDC',
      customerIdentifier: '43901766923',
      voucherPin: '1234-5678',
      merchantName: 'Shop',
      merchantUrl: 'https://shop.example.com',
    });

    expect(html).not.toContain('Address');
  });

  it('does not label token-based receipts without a PIN as directly active', () => {
    const payload = {
      transactionId: 'tx-1',
      reference: 'REF-123',
      customerName: 'Ada',
      amount: 2500,
      type: 'electricity' as const,
      providerLabel: 'EKEDC',
      customerIdentifier: '43901766923',
      voucherPin: null,
      phone_number: '08012345678',
      merchantName: 'Shop',
      merchantUrl: 'https://shop.example.com',
    };

    const html = generateVtuTokenReceiptEmail(payload);
    const text = generateVtuTokenReceiptText(payload);

    expect(html).toContain('TOKEN FULFILLMENT IN PROGRESS');
    expect(html).toContain('Payment Received');
    expect(html).toContain('token fulfillment is still in progress');
    expect(html).not.toContain('Directly Successful &amp; Active');
    expect(html).not.toContain('No PIN entry required');
    expect(html).not.toContain('is ready');
    expect(html).not.toContain('vend request has been fulfilled');
    expect(text).toContain('Token fulfillment is still in progress');
    expect(text).toContain("we're still retrieving the service token");
    expect(text).not.toContain('verified and fulfilled');
    expect(text).not.toContain('No PIN entry required');
  });

  it('escapes direct-success receipt fields in HTML and text variants', () => {
    const payload = {
      transactionId: 'tx-1',
      reference: 'REF-<script>alert(1)</script>',
      customerName: 'Ada <img src=x onerror=alert(1)>',
      amount: 2500,
      type: 'airtime' as const,
      providerLabel: 'MTN <b>bad</b>',
      customerIdentifier: '080<script>target()</script>',
      voucherPin: null,
      phone_number: '080<script>phone()</script>',
      merchantName: 'Shop <script>brand()</script>',
      merchantUrl: 'javascript:alert(1)',
      supportEmail: 'help@example.com<script>alert(1)</script>',
      merchantTin: 'TIN-<script>tin()</script>',
      merchantRcNumber: 'RC-<script>rc()</script>',
    };

    const html = generateVtuTokenReceiptEmail(payload);
    const text = generateVtuTokenReceiptText(payload);
    const output = `${html}\n${text}`;

    expect(html).toContain('Directly Successful & Active');
    expect(html).toContain('href="#"');
    expect(output).toContain('RC: RC-&lt;script&gt;rc()&lt;/script&gt;');
    expect(output).toContain('TIN: TIN-&lt;script&gt;tin()&lt;/script&gt;');
    expect(output).not.toContain('<script>');
    expect(output).not.toContain('javascript:alert(1)');
  });
});
