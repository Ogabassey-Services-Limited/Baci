import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../lib/storage', () => ({
  syncStorage: {
    getItem: jest.fn(() => null),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

import {
  type SavedItem,
  selectSavedProductIds,
  useSavedStore,
} from './saved-store';

function savedItem(productId: string): SavedItem {
  return {
    id: `saved-${productId}`,
    product_id: productId,
    name: productId,
    slug: productId,
    price: 1,
    image: '',
    savedAt: 0,
  };
}

const EMPTY_TOAST = { show: false, message: '', type: 'add' as const };

describe('selectSavedProductIds', () => {
  beforeEach(() => {
    useSavedStore.setState({ items: [], toastState: EMPTY_TOAST });
  });

  it('exposes the set of saved product ids for O(1) membership', () => {
    useSavedStore.setState({
      items: [savedItem('p1'), savedItem('p2')],
      toastState: EMPTY_TOAST,
    });

    const ids = selectSavedProductIds(useSavedStore.getState());

    expect(ids.has('p1')).toBe(true);
    expect(ids.has('p2')).toBe(true);
    expect(ids.has('p3')).toBe(false);
  });

  it('memoizes the set until items change', () => {
    useSavedStore.setState({
      items: [savedItem('p1')],
      toastState: EMPTY_TOAST,
    });
    const first = selectSavedProductIds(useSavedStore.getState());

    expect(selectSavedProductIds(useSavedStore.getState())).toBe(first);

    useSavedStore.setState({
      items: [savedItem('p1'), savedItem('p2')],
      toastState: EMPTY_TOAST,
    });

    expect(selectSavedProductIds(useSavedStore.getState())).not.toBe(first);
  });
});
