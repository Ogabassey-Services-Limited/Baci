import { getOrdersListItemShadowStyle } from './OrdersListItem.shadows';

describe('getOrdersListItemShadowStyle', () => {
  it('uses a status-colored CSS box-shadow on web', () => {
    expect(getOrdersListItemShadowStyle('web', '#2563EB')).toEqual({
      boxShadow: '0px 10px 18px rgba(37, 99, 235, 0.08)',
    });
  });

  it('preserves the native status-colored shadow contract', () => {
    expect(getOrdersListItemShadowStyle('native', '#2563EB')).toEqual({
      shadowColor: '#2563EB',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.08,
      shadowRadius: 18,
      elevation: 3,
    });
  });
});
