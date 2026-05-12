import ImeiCheckerScreen from '@/app/imei-check';

describe('IMEI route entry', () => {
  it('exports the IMEI screen component', () => {
    expect(ImeiCheckerScreen).toBeDefined();
    expect(typeof ImeiCheckerScreen).toBe('function');
  });
});
