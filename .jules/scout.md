2026-06-27 — [Password Validation Bug]
Learning: validatePassword contains a logical flaw where it requires strength >= 2 for validity, but checkPasswordStrength explicitly caps 8-9 character passwords at strength 1, rendering 8-9 character passwords unconditionally invalid regardless of complexity or NIST SP 800-63B guidelines.
Action: When testing validation utilities with intertwined strength calculators, explicitly test boundary values (like 8, 9, 10 characters) against both functions individually and together to surface mismatched constraints.
Source: NIST SP 800-63B
