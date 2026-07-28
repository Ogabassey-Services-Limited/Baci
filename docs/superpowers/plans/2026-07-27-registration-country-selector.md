# Registration Country Selector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the registration country's 50-item chip grid with a compact field that opens the existing searchable country picker.

**Architecture:** `RegisterBusinessStep` owns one boolean for sheet visibility and resolves the current ISO country code to its display name. It conditionally mounts the existing `CountryPickerModal` so each opening starts with a clean search, while the shared picker continues to own search, country rows, selected state, and sheet accessibility. Dedicated styles in `register.styles.ts` make the selector visually consistent with the existing form without reusing TextInput-only styling.

**Tech Stack:** React 19, React Native, TypeScript, Vitest, React Testing Library, existing `CountryPickerModal` and `COUNTRIES` constants.

## Global Constraints

- Nigeria remains selected by default through the parent registration form; this component must display the country supplied in `formData.country`.
- The form continues to store and submit ISO country codes.
- Do not change the supported-country list, infer a country automatically, or change currency behavior.
- Preserve Business Name title casing and all existing registration fields and callbacks.
- Use the existing searchable `CountryPickerModal`; do not create a second picker implementation.
- Preserve all pre-existing dirty worktree changes. In particular, `RegisterBusinessStep.tsx` and its test already contain the approved Business Name title-casing work; do not overwrite or silently exclude it.
- Execute from an isolated branch based on current `origin/main`, never from the dirty `/Users/mac/Baci-app` root checkout.

---

### Task 1: Searchable registration country selector

**Files:**
- Modify: `apps/mobile-admin/components/auth/register/RegisterBusinessStep.tsx`
- Modify: `apps/mobile-admin/components/auth/register/register.styles.ts`
- Test: `apps/mobile-admin/components/auth/register/RegisterBusinessStep.test.tsx`

**Interfaces:**
- Consumes: `CountryPickerModal({ visible, selectedCountry, onSelect, onClose })`, `COUNTRIES`, and `onCountryChange(countryCode: string)`.
- Produces: A `Country / Region` button that displays the selected country name and opens the existing picker without changing `RegisterBusinessStepProps`.

- [ ] **Step 1: Confirm the execution baseline and protect overlapping edits**

Run from the execution checkout root:

```bash
git fetch origin main
git status --short
git diff -- apps/mobile-admin/components/auth/register/RegisterBusinessStep.tsx apps/mobile-admin/components/auth/register/RegisterBusinessStep.test.tsx apps/mobile-admin/components/auth/register/register.styles.ts
sed -n '1,260p' apps/mobile-admin/components/auth/register/RegisterBusinessStep.test.tsx
git branch --show-current
```

Expected: `origin/main` resolves to the intended implementation base; the diff shows the already-approved Business Name title-casing change in `RegisterBusinessStep.tsx`; the status/output also exposes its currently untracked colocated regression test; no command resets, stashes, or discards either file. If the current branch is `main`, create the scoped branch before editing:

```bash
git switch -c codex/mobile-admin-registration-fields
```

- [ ] **Step 2: Extend the component test harness and write failing behavior tests**

Mock `CountryPickerModal` with a visible-only dialog that can select Ghana or close:

```tsx
vi.mock('@/components/ui/CountryPickerModal', () => ({
  CountryPickerModal: ({
    onClose,
    onSelect,
    selectedCountry,
    visible,
  }: {
    onClose: () => void;
    onSelect: (country: {
      code: string;
      currency: string;
      currencySymbol: string;
      name: string;
    }) => void;
    selectedCountry: string;
    visible: boolean;
  }) =>
    visible ? (
      <section aria-label="country picker">
        <span>{selectedCountry}</span>
        <button
          aria-label="Ghana"
          onClick={() =>
            onSelect({
              code: 'GH',
              currency: 'GHS',
              currencySymbol: '₵',
              name: 'Ghana',
            })
          }
          type="button"
        />
        <button aria-label="Close country picker" onClick={onClose} type="button" />
      </section>
    ) : null,
}));
```

Add a `renderStep` helper that returns stable callback mocks:

```tsx
function renderStep({ country = 'NG' }: { country?: string } = {}) {
  const onCountryChange = vi.fn();
  render(
    <RegisterBusinessStep
      formData={{
        businessName: '',
        businessType: '',
        country,
        otherBusinessType: '',
        slug: '',
      }}
      isLoading={false}
      onBusinessNameChange={vi.fn()}
      onBusinessTypeChange={vi.fn()}
      onCountryChange={onCountryChange}
      onLaunchStore={vi.fn()}
      onOtherBusinessTypeChange={vi.fn()}
      onSlugChange={vi.fn()}
    />
  );

  return { onCountryChange };
}
```

Then add these tests:

```tsx
it('shows the selected country and opens the searchable picker', () => {
  renderStep({ country: 'NG' });

  expect(screen.getByRole('button', { name: 'Country / Region, Nigeria' })).toBeInTheDocument();
  expect(screen.queryByLabelText('country picker')).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Country / Region, Nigeria' }));

  expect(screen.getByLabelText('country picker')).toBeInTheDocument();
  expect(screen.getByText('NG')).toBeInTheDocument();
});

it('stores the selected country code and closes the picker', () => {
  const { onCountryChange } = renderStep({ country: 'NG' });
  fireEvent.click(screen.getByRole('button', { name: 'Country / Region, Nigeria' }));

  fireEvent.click(screen.getByRole('button', { name: 'Ghana' }));

  expect(onCountryChange).toHaveBeenCalledWith('GH');
  expect(screen.queryByLabelText('country picker')).not.toBeInTheDocument();
});

it('closes without changing the selected country', () => {
  const { onCountryChange } = renderStep({ country: 'NG' });
  fireEvent.click(screen.getByRole('button', { name: 'Country / Region, Nigeria' }));

  fireEvent.click(screen.getByRole('button', { name: 'Close country picker' }));

  expect(onCountryChange).not.toHaveBeenCalled();
  expect(screen.queryByLabelText('country picker')).not.toBeInTheDocument();
});
```

- [ ] **Step 3: Run the focused test to verify it fails**

Run:

```bash
pnpm --filter baci-mobile-admin exec vitest run components/auth/register/RegisterBusinessStep.test.tsx
```

Expected: FAIL because the registration screen still renders individual `Country Nigeria`, `Country Ghana`, and other chip buttons, and never renders the picker mock.

- [ ] **Step 4: Implement the compact field and picker integration**

Import `useState` and `CountryPickerModal`:

```tsx
import { useState } from 'react';
import { CountryPickerModal } from '@/components/ui/CountryPickerModal';
```

Inside `RegisterBusinessStep`, derive the display country and own sheet state:

```tsx
const [isCountryPickerVisible, setIsCountryPickerVisible] = useState(false);
const selectedCountry = COUNTRIES.find(
  (country) => country.code === formData.country
);
const selectedCountryName = selectedCountry?.name ?? 'Select country';
```

Replace the chip grid with one accessible field:

```tsx
<View style={styles.inputGroup}>
  <Text style={styles.label}>Country / Region</Text>
  <Pressable
    accessibilityLabel={`Country / Region, ${selectedCountryName}`}
    accessibilityRole="button"
    onPress={() => setIsCountryPickerVisible(true)}
    style={({ pressed }) => [
      styles.countrySelector,
      pressed && { opacity: 0.7 },
    ]}
  >
    <Text style={styles.countrySelectorText}>{selectedCountryName}</Text>
    <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
  </Pressable>
</View>
```

Add dedicated styles to `register.styles.ts`:

```tsx
countrySelector: {
  alignItems: 'center',
  backgroundColor: colors.inputBg,
  borderColor: colors.border,
  borderRadius: RADIUS.md,
  borderWidth: 1,
  flexDirection: 'row',
  justifyContent: 'space-between',
  minHeight: 48,
  padding: SPACING.md,
},
countrySelectorText: {
  color: colors.text,
  fontFamily: TYPOGRAPHY.fontFamily.regular,
  fontSize: TYPOGRAPHY.size.md,
},
```

Conditionally mount the shared picker as the final child of the form section. This resets stale search text whenever the sheet is dismissed and reopened, while selection still comes from `formData.country`:

```tsx
{isCountryPickerVisible ? (
  <CountryPickerModal
    onClose={() => setIsCountryPickerVisible(false)}
    onSelect={(country) => {
      onCountryChange(country.code);
      setIsCountryPickerVisible(false);
    }}
    selectedCountry={formData.country}
    visible={true}
  />
) : null}
```

- [ ] **Step 5: Run focused registration and picker tests**

Run:

```bash
pnpm --filter baci-mobile-admin exec vitest run components/auth/register/RegisterBusinessStep.test.tsx components/ui/CountryPickerModal.test.tsx
```

Expected: both suites PASS, including the existing Business Name title-casing regression.

- [ ] **Step 6: Run focused static validation**

Run:

```bash
pnpm --filter baci-mobile-admin exec biome check components/auth/register/RegisterBusinessStep.tsx components/auth/register/RegisterBusinessStep.test.tsx components/auth/register/register.styles.ts
pnpm --filter baci-mobile-admin exec tsc --noEmit
```

Expected: both commands exit 0 with no Biome or TypeScript errors. `RegisterBusinessStep.tsx`, its test, and `register.styles.ts` remain below the 300-line limit.

- [ ] **Step 7: Review the uncommitted implementation**

Run:

```bash
coderabbit review --agent -t uncommitted
```

Expected: no critical or high-severity findings remain. Fix any still-applicable critical or high finding, then rerun its focused tests and focused static check before continuing.

- [ ] **Step 8: Run the repository quality gate after review fixes**

Run from a complete isolated checkout at the repository root:

```bash
pnpm turbo lint
pnpm turbo typecheck
pnpm turbo test
```

Expected: all three commands exit 0 against the final reviewed code. If the active test checkout is sparse, expand it to include all workspace apps, packages, patches, and CI scripts before this gate; do not treat missing sparse-checkout files as product failures and do not skip the gate.

- [ ] **Step 9: Restart Metro and verify on the physical iPhone**

Stop the existing Metro process and restart the dev client server from `apps/mobile-admin` with the same LAN host and custom scheme:

```bash
CI=1 EXPO_OFFLINE=1 EXPO_NO_DEPENDENCY_VALIDATION=1 EXPO_NO_TELEMETRY=1 ../../node_modules/.bin/expo start --dev-client --scheme baciadmin --host lan --port 8081
```

Keep the local Next server bound to `0.0.0.0:3000` in polling mode so the physical iPhone can reach `/api/mobile-onboarding` without the file-watcher exhaustion seen during this test session.

From `apps/web`, use:

```bash
WATCHPACK_POLLING=true WATCHPACK_POLLING_INTERVAL=1000 ../../node_modules/.bin/next dev --webpack --hostname 0.0.0.0 --port 3000
```

Expected: the Business Details step displays one Country / Region field; tapping it opens a searchable sheet; searching filters the list; closing and reopening starts with an empty search; selecting a country updates the field; tapping Launch Store sends the selected ISO code through the unchanged registration payload; and neither Metro nor the onboarding API reports a red-screen, connectivity, or route-registration error. Do not print passwords, tokens, or the request body while observing logs.

- [ ] **Step 10: Commit the reviewed feature without staging unrelated work**

```bash
git add apps/mobile-admin/components/auth/register/RegisterBusinessStep.tsx apps/mobile-admin/components/auth/register/RegisterBusinessStep.test.tsx apps/mobile-admin/components/auth/register/register.styles.ts
git diff --cached --check
git diff --cached --name-only
git commit -m "feat(mobile-admin): improve business registration fields"
```

Expected staged paths are exactly the three files listed above. The commit intentionally includes both already-approved Business Name title casing and the searchable Country / Region selector because those edits overlap in the same component and test file; unrelated account-step and Expo Router test changes remain unstaged.
