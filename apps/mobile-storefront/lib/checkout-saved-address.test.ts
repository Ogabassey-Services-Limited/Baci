import {
  buildSavedAddressFromCheckout,
  findMatchingSavedAddress,
  getDefaultSavedAddress,
  toCheckoutAddressValues,
  upsertSavedAddress,
  type SavedAddress,
} from './checkout-saved-address';

const checkoutAddress = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.com',
  phone: '08030000000',
  address: '12 Marina Road',
  city: 'Lagos',
  state: 'Lagos',
  notes: '',
};

describe('checkout-saved-address', () => {
  it('returns the default saved address when available', () => {
    const addresses: SavedAddress[] = [
      {
        id: 'one',
        label: 'Home',
        full_name: 'Ada Lovelace',
        phone: '08030000000',
        address: '12 Marina Road',
        city: 'Lagos',
        state: 'Lagos',
        country: 'Nigeria',
      },
      {
        id: 'two',
        label: 'Office',
        full_name: 'Ada Lovelace',
        phone: '08030000000',
        address: '1 Broad Street',
        city: 'Lagos',
        state: 'Lagos',
        country: 'Nigeria',
        is_default: true,
      },
    ];

    expect(getDefaultSavedAddress(addresses)?.id).toBe('two');
  });

  it('maps a saved address into checkout field values', () => {
    expect(
      toCheckoutAddressValues({
        id: 'one',
        label: 'Home',
        full_name: 'Ada Lovelace',
        phone: '08030000000',
        address: '12 Marina Road',
        city: 'Lagos',
        state: 'Lagos',
        country: 'Nigeria',
      })
    ).toEqual({
      firstName: 'Ada',
      lastName: 'Lovelace',
      phone: '08030000000',
      address: '12 Marina Road',
      city: 'Lagos',
      state: 'Lagos',
    });
  });

  it('matches the same address despite spacing or case changes', () => {
    const saved = buildSavedAddressFromCheckout(
      { ...checkoutAddress, address: ' 12   MARINA road ' },
      { id: 'one' }
    );

    expect(findMatchingSavedAddress([saved], checkoutAddress)?.id).toBe('one');
  });

  it('upserts a new default address and clears previous defaults', () => {
    const next = upsertSavedAddress(
      [
        {
          id: 'old',
          label: 'Home',
          full_name: 'Grace Hopper',
          phone: '08020000000',
          address: '1 Allen Avenue',
          city: 'Ikeja',
          state: 'Lagos',
          country: 'Nigeria',
          is_default: true,
        },
      ],
      checkoutAddress,
      { setAsDefault: true }
    );

    expect(next).toHaveLength(2);
    expect(next.find((item) => item.is_default)?.full_name).toBe(
      'Ada Lovelace'
    );
    expect(next.find((item) => item.id === 'old')?.is_default).toBe(false);
  });

  it('updates the selected saved address instead of duplicating it', () => {
    const existing = buildSavedAddressFromCheckout(checkoutAddress, {
      id: 'saved-id',
      label: 'Home',
      isDefault: true,
    });

    const next = upsertSavedAddress(
      [existing],
      { ...checkoutAddress, address: '14 Marina Road' },
      { selectedSavedAddressId: 'saved-id', setAsDefault: true }
    );

    expect(next).toHaveLength(1);
    expect(next[0]?.id).toBe('saved-id');
    expect(next[0]?.address).toBe('14 Marina Road');
  });
});
