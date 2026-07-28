# Registration Country Selector Design

## Goal

Replace the registration screen's long grid of country chips with a compact,
searchable country selector that remains easy to use on a phone.

## User experience

- The Business Details step shows a full-width `Country / Region` field.
- The field displays the selected country's name and a chevron.
- Nigeria remains selected by default.
- Tapping the field opens the existing `CountryPickerModal` as a full-page
  sheet.
- The sheet provides search and displays the country and its currency.
- Selecting a country updates the registration form and closes the sheet.
- Dismissing the sheet without choosing preserves the current selection.

## Implementation

`RegisterBusinessStep` will own the picker's visible state and render the
existing `CountryPickerModal`. It will pass the form's current country code as
the selected value and call the existing `onChange('country', code)` callback
when the user chooses a country.

The chip grid will be removed. No country data source or registration payload
format changes are needed: the form continues to store and submit the ISO
country code from `COUNTRIES`.

## Accessibility

- The selector is exposed as a button with a descriptive label and selected
  value.
- The existing modal retains its search field, close action, and accessible
  country rows.
- The selected state is visible in both the field and modal.

## Tests

The colocated `RegisterBusinessStep` tests will verify that:

1. Nigeria is displayed when it is the current selection.
2. Pressing the country field opens the searchable picker.
3. Selecting another country calls `onChange` with its country code and closes
   the picker.
4. Closing without a selection does not change the country.
5. Business-name title casing continues to work.

## Out of scope

- Changing the supported-country list.
- Automatic country detection.
- Changing currency selection or registration API payloads.
