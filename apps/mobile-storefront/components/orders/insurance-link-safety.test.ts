import {
  normalizeInsuranceCertificateUrl,
  normalizeInsuranceFlowUrl,
} from './insurance-link-safety';

describe('normalizeInsuranceFlowUrl', () => {
  it('allows https MyCover hosted links', () => {
    expect(
      normalizeInsuranceFlowUrl('  https://mycover.ai/purchase?q=claim  ')
    ).toBe('https://mycover.ai/purchase?q=claim');
    expect(
      normalizeInsuranceFlowUrl('https://claims.mycover.ai/purchase?q=claim')
    ).toBe('https://claims.mycover.ai/purchase?q=claim');
  });

  it('rejects unsafe schemes and non-MyCover hosts', () => {
    expect(normalizeInsuranceFlowUrl('javascript:alert(1)')).toBeNull();
    expect(normalizeInsuranceFlowUrl('tel:+2348012345678')).toBeNull();
    expect(normalizeInsuranceFlowUrl('http://mycover.ai/purchase')).toBeNull();
    expect(
      normalizeInsuranceFlowUrl('https://evil.example/purchase')
    ).toBeNull();
    expect(normalizeInsuranceFlowUrl('not a url')).toBeNull();
  });
});

describe('normalizeInsuranceCertificateUrl', () => {
  it('allows https certificate URLs from trusted MyCover origins', () => {
    expect(
      normalizeInsuranceCertificateUrl('  https://ss.mycover.ai/policy.pdf  ')
    ).toBe('https://ss.mycover.ai/policy.pdf');
    expect(
      normalizeInsuranceCertificateUrl(
        'https://s3.eu-west-2.amazonaws.com/staging.mycover/policy.pdf'
      )
    ).toBe('https://s3.eu-west-2.amazonaws.com/staging.mycover/policy.pdf');
  });

  it('rejects non-https and untrusted certificate URLs', () => {
    expect(normalizeInsuranceCertificateUrl('javascript:alert(1)')).toBeNull();
    expect(
      normalizeInsuranceCertificateUrl('http://ss.mycover.ai/policy.pdf')
    ).toBeNull();
    expect(
      normalizeInsuranceCertificateUrl('https://cdn.example.com/policy.pdf')
    ).toBeNull();
    expect(
      normalizeInsuranceCertificateUrl(
        'https://s3.eu-west-2.amazonaws.com/attacker-bucket/policy.pdf'
      )
    ).toBeNull();
  });
});
