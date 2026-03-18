import { AIGradeDeviceApiResponseSchema } from './commerce-schemas';

describe('AIGradeDeviceApiResponseSchema', () => {
  it('validates successful AI grade payloads', () => {
    expect(
      AIGradeDeviceApiResponseSchema.safeParse({
        success: true,
        data: {
          model: 'iPhone 13 Pro',
          grade: 'Good',
          observations: ['Minor scratch'],
          basePrice: 500000,
          estimatedValue: 450000,
          deductionPercent: 10,
        },
      }).success
    ).toBe(true);
  });

  it('requires success on AI grade payloads', () => {
    expect(
      AIGradeDeviceApiResponseSchema.safeParse({
        data: {
          model: 'iPhone 13 Pro',
          grade: 'Good',
          observations: [],
          basePrice: 500000,
          estimatedValue: 450000,
          deductionPercent: 10,
        },
      }).success
    ).toBe(false);
  });

  it('rejects payloads with missing required data fields', () => {
    expect(
      AIGradeDeviceApiResponseSchema.safeParse({
        success: true,
        data: {
          model: 'iPhone 13 Pro',
          observations: ['Minor scratch'],
          basePrice: 500000,
          deductionPercent: 10,
        },
      }).success
    ).toBe(false);
  });

  it('rejects payloads with invalid observations type', () => {
    expect(
      AIGradeDeviceApiResponseSchema.safeParse({
        success: true,
        data: {
          model: 'iPhone 13 Pro',
          grade: 'Good',
          observations: 'Minor scratch',
          basePrice: 500000,
          estimatedValue: 450000,
          deductionPercent: 10,
        },
      }).success
    ).toBe(false);
  });

  it('rejects payloads with invalid basePrice type', () => {
    expect(
      AIGradeDeviceApiResponseSchema.safeParse({
        success: true,
        data: {
          model: 'iPhone 13 Pro',
          grade: 'Good',
          observations: ['Minor scratch'],
          basePrice: '500000',
          estimatedValue: 450000,
          deductionPercent: 10,
        },
      }).success
    ).toBe(false);
  });
});
