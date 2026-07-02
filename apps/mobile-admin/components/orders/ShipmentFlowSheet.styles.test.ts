import { describe, expect, it } from 'vitest';
import { styles } from './ShipmentFlowSheet.styles';

describe('ShipmentFlowSheet styles', () => {
  it('keeps the outside dismiss region covering the space above the sheet', () => {
    expect(styles.dismissRegion).toMatchObject({
      flex: 1,
      width: '100%',
    });
  });

  it('keeps identifier scan controls as square icon buttons', () => {
    expect(styles.identifierScanButton).toMatchObject({
      height: 44,
      width: 44,
    });
  });
});
