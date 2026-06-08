1. **Explore `accessibilityState` in `apps/mobile-admin/components/orders/ShipmentFlowFooter.tsx`**:
   - The primary button and back button inside `ShipmentFlowFooter` are interactive submit actions that are disabled during submission (`isSubmitting`).
   - According to the Baci UX standard, buttons in a loading state should explicitly implement `accessibilityState={{ disabled: isSubmitting, busy: isSubmitting }}` to properly announce their busy status to screen readers.
   - Currently, they only use `accessibilityState={{ disabled: isSubmitting }}`.

2. **Modify `apps/mobile-admin/components/orders/ShipmentFlowFooter.tsx`**:
   - Update `accessibilityState` of both `<Pressable>` components to include `busy: isSubmitting`.

3. **Verify the changes**:
   - Run linter on `ShipmentFlowFooter.tsx` to verify syntax.

4. **Complete pre-commit steps**:
   - Run `pre_commit_instructions` to ensure proper testing, verification, review, and reflection are done.

5. **Submit the change**:
   - Use `submit` to push code with descriptive title/description.
