import { migrateLegacyCartItems, migratePersistedCartState } from '@/stores/cart-store-persistence';

describe('migrateLegacyCartItems', () => {
  it('hydrates selected attributes from deprecated top-level color and storage fields', () => {
    expect(
      migrateLegacyCartItems([
        {
          color: ' Black ',
          storage: ' 128GB ',
        },
      ])
    ).toEqual([
      {
        color: ' Black ',
        storage: ' 128GB ',
        selected_attributes: {
          color: 'Black',
          storage: '128GB',
        },
      },
    ]);
  });

  it('preserves existing selections while backfilling missing legacy axes', () => {
    expect(
      migrateLegacyCartItems([
        {
          color: 'Black',
          selected_attributes: { sim_type: 'eSIM Only' },
          storage: '256GB',
        },
      ])
    ).toEqual([
      {
        color: 'Black',
        selected_attributes: {
          sim_type: 'eSIM Only',
          color: 'Black',
          storage: '256GB',
        },
        storage: '256GB',
      },
    ]);
  });

  it('returns an empty array when persisted items are empty', () => {
    expect(migrateLegacyCartItems([])).toEqual([]);
  });

  it('skips malformed persisted entries before backfilling legacy fields', () => {
    expect(
      migrateLegacyCartItems([
        null,
        {
          color: 'Black',
          storage: '128GB',
        },
        undefined,
      ] as unknown as Array<{ color?: string; storage?: string }>)
    ).toEqual([
      {
        color: 'Black',
        storage: '128GB',
        selected_attributes: {
          color: 'Black',
          storage: '128GB',
        },
      },
    ]);
  });

  it('handles partial legacy selections without throwing', () => {
    expect(
      migrateLegacyCartItems([
        {
          storage: '256GB',
        },
      ])
    ).toEqual([
      {
        storage: '256GB',
        selected_attributes: {
          storage: '256GB',
        },
      },
    ]);
  });

  it('does not overwrite existing color or storage selections', () => {
    expect(
      migrateLegacyCartItems([
        {
          color: 'Black',
          selected_attributes: {
            color: 'Silver',
            storage: '512GB',
          },
          storage: '256GB',
        },
      ])
    ).toEqual([
      {
        color: 'Black',
        selected_attributes: {
          color: 'Silver',
          storage: '512GB',
        },
        storage: '256GB',
      },
    ]);
  });
});

describe('migratePersistedCartState', () => {
  it('migrates legacy persisted items for older storage versions', () => {
    expect(
      migratePersistedCartState(
        {
          items: [
            {
              color: ' Black ',
              storage: ' 128GB ',
            },
          ],
        },
        1
      )
    ).toEqual({
      items: [
        {
          color: ' Black ',
          storage: ' 128GB ',
          selected_attributes: {
            color: 'Black',
            storage: '128GB',
          },
        },
      ],
    });
  });

  it('treats version 0 as a legacy migration path', () => {
    expect(
      migratePersistedCartState(
        {
          items: [
            {
              color: 'Black',
              storage: '128GB',
            },
          ],
        },
        0
      )
    ).toEqual({
      items: [
        {
          color: 'Black',
          storage: '128GB',
          selected_attributes: {
            color: 'Black',
            storage: '128GB',
          },
        },
      ],
    });
  });

  it('preserves valid persisted items for current storage versions', () => {
    expect(
      migratePersistedCartState(
        {
          items: [
            {
              selected_attributes: {
                storage: '256GB',
              },
            },
          ],
        },
        2
      )
    ).toEqual({
      items: [
        {
          selected_attributes: {
            storage: '256GB',
          },
        },
      ],
    });
  });

  it('returns an empty items array when persisted items are undefined', () => {
    expect(migratePersistedCartState({ items: undefined }, 2)).toEqual({
      items: [],
    });
  });
  it('returns an empty items array when persisted items are missing', () => {
    expect(migratePersistedCartState({}, 2)).toEqual({
      items: [],
    });
  });
  it('keeps an empty persisted items array intact', () => {
    expect(migratePersistedCartState({ items: [] }, 2)).toEqual({
      items: [],
    });
  });

  it('treats unknown version numbers as current-state passthroughs', () => {
    expect(
      migratePersistedCartState(
        {
          items: [
            {
              selected_attributes: {
                storage: '512GB',
              },
            },
          ],
        },
        3
      )
    ).toEqual({
      items: [
        {
          selected_attributes: {
            storage: '512GB',
          },
        },
      ],
    });
  });

  it('treats negative version numbers as current-state passthroughs', () => {
    expect(
      migratePersistedCartState(
        {
          items: [
            {
              selected_attributes: {
                storage: '1TB',
              },
            },
          ],
        },
        -1
      )
    ).toEqual({
      items: [
        {
          selected_attributes: {
            storage: '1TB',
          },
        },
      ],
    });
  });

  it('falls back to an empty cart when persisted migration data is malformed', () => {
    expect(
      migratePersistedCartState(
        {
          items: null as unknown as never[],
        },
        2
      )
    ).toEqual({
      items: [],
    });
  });

  it('filters malformed entries from current-version persisted items', () => {
    expect(
      migratePersistedCartState(
        {
          items: [
            null,
            {
              selected_attributes: {
                storage: '256GB',
              },
            },
            'bad item',
          ] as unknown as never[],
        },
        2
      )
    ).toEqual({
      items: [
        {
          selected_attributes: {
            storage: '256GB',
          },
        },
      ],
    });
  });
});
