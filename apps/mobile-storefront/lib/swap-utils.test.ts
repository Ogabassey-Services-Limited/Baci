import {
  buildSwapInquiryMessage,
  buildSwapWhatsappUrl,
  getSwapGradeColor,
} from './swap-utils';
import type { AIAnalysisResult } from '@/lib/validation';

const colors = {
  error: '#dc2626',
  primary: '#2563eb',
  success: '#059669',
  warning: '#d97706',
} as const;

const analysisResult: AIAnalysisResult = {
  model: 'iPhone 13 Pro',
  grade: 'Good',
  estimatedValue: 275000,
  basePrice: 300000,
  deductionPercent: 8.33,
  observations: [
    'Minor screen scratch',
    'Battery health at 89%\nNeeds review',
  ],
};

describe('getSwapGradeColor', () => {
  it.each([
    ['Excellent', colors.success],
    ['Good', colors.primary],
    ['Fair', colors.warning],
    ['Poor', colors.error],
  ])('returns expected color for %s', (grade, expected) => {
    expect(getSwapGradeColor(grade, colors)).toBe(expected);
  });
});

describe('buildSwapInquiryMessage', () => {
  it('builds a readable message and normalizes observation newlines', () => {
    const message = buildSwapInquiryMessage(analysisResult);

    expect(message).toContain('Device: iPhone 13 Pro');
    expect(message).toContain('Grade: Good');
    expect(message).toContain('Estimate: N275,000');
    expect(message).toContain(
      'Observations: Minor screen scratch, Battery health at 89% Needs review'
    );
  });
});

describe('buildSwapWhatsappUrl', () => {
  it('returns a wa.me URL with the encoded inquiry message', () => {
    const url = buildSwapWhatsappUrl(analysisResult, '2348012345678');

    expect(url.startsWith('https://wa.me/2348012345678?text=')).toBe(true);
    expect(decodeURIComponent(url)).toContain(
      "I'd like to proceed with the swap."
    );
  });
});
