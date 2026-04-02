import { getAutocompleteDropdownFrame } from './address-autocomplete-layout';

describe('getAutocompleteDropdownFrame', () => {
  it('places the dropdown below the input when there is enough space', () => {
    expect(
      getAutocompleteDropdownFrame({
        anchorRect: { x: 24, y: 180, width: 320, height: 52 },
        windowHeight: 844,
        windowWidth: 390,
      })
    ).toEqual({
      left: 24,
      maxHeight: 320,
      top: 240,
      width: 320,
    });
  });

  it('moves the dropdown above the input when space below is too tight', () => {
    expect(
      getAutocompleteDropdownFrame({
        anchorRect: { x: 24, y: 650, width: 320, height: 52 },
        windowHeight: 844,
        windowWidth: 390,
      })
    ).toEqual({
      left: 24,
      maxHeight: 320,
      top: 322,
      width: 320,
    });
  });

  it('clamps the dropdown width within the screen gutters', () => {
    expect(
      getAutocompleteDropdownFrame({
        anchorRect: { x: 12, y: 220, width: 380, height: 52 },
        windowHeight: 844,
        windowWidth: 390,
      })
    ).toEqual({
      left: 16,
      maxHeight: 320,
      top: 280,
      width: 358,
    });
  });
});
