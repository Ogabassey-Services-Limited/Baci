import {
  normalizeInsuranceCertificateUrl,
  normalizeInsuranceFlowUrl,
} from './insurance-link-safety';

describe('normalizeInsuranceFlowUrl', () => {
  it('allows https MyCover hosted links', () => {
    expect(normalizeInsuranceFlowUrl('  https://mycover.ai/purchase?q=claim  ')).toBe(
      'https://mycover.ai/purchase?q=claim'
    );
    expect(
      normalizeInsuranceFlowUrl('https://claims.mycover.ai/purchase?q=claim')
    ).toBe('https://claims.mycover.ai/purchase?q=claim');
  });

  it('rejects unsafe schemes and non-MyCover hosts', () => {
    expect(normalizeInsuranceFlowUrl('javascript:alert(1)')).toBeNull();
    expect(normalizeInsuranceFlowUrl('tel:+2348012345678')).toBeNull();
    expect(normalizeInsuranceFlowUrl('http://mycover.ai/purchase')).toBeNull();
    expect(normalizeInsuranceFlowUrl('https://evil.example/purchase')).toBeNull();
    expect(normalizeInsuranceFlowUrl('not a url')).toBeNull();
  });
});

describe('normalizeInsuranceCertificateUrl', () => {
  it('allows https certificate URLs from provider/CDN hosts', () => {
    expect(
      normalizeInsuranceCertificateUrl('  https://cdn.example.com/policy.pdf  ')
    ).toBe('https://cdn.example.com/policy.pdf');
  });

  it('rejects non-https certificate URLs', () => {
    expect(normalizeInsuranceCertificateUrl('javascript:alert(1)')).toBeNull();
    expect(normalizeInsuranceCertificateUrl('http://cdn.example.com/policy.pdf')).toBeNull();
  });
});
