---
description: Guide for resolving security alerts systematically
---

This workflow guides the resolution of security alerts extracted by `@/extract-security-alerts`.

**Prerequisites:**
- Run `@/extract-security-alerts` first to generate `security_alerts_todo.md`.

### 1. Analysis
Read the `security_alerts_todo.md` file.
- Identify the highest severity issues (Error/High).
- Group issues by "Rule ID" (e.g., `unsafe-formatstring`, `xss`).
- Many alerts might be the same issue repeated across multiple files (or multiple lines in the same file).

### 2. Resolution Loop (Per Rule Category)
For each Rule Category (start with High Severity):

1.  **Understand the Vulnerability**:
    - Read the "Message" and "Rule ID".
    - If needed, search the Rule ID online (e.g., Semgrep rules) to understand the fix.

2.  **Apply Fixes**:
    - Open the file(s).
    - Apply the recommended fix (e.g., using structured logging, sanitizing input, removing secrets).
    - **DRY Principle**: If the same fix applies to 10 files, try to apply it efficiently (or create a shared utility if appropriate).

3.  **Verification**:
    - **Lint**: Run `npm run lint` to ensure no new code style issues.
    - **Typecheck**: Run `npm run typecheck` to ensure no broken types.
    - **Regression**: Ensure the code still compiles/runs.

### 3. Progress Tracking
- As you fix, update `security_alerts_todo.md` (or your mental state) to mark items as done.
- If an alert is a "False Positive", add a comment explaining why, or add a suppression comment (e.g., `// nosemgrep: rule-id`) if the project policy allows.

### 4. Final Verification
- Once all targeted alerts are fixed, you can re-run the extraction workflow (Step 1) to see if the count drops (Note: GitHub API might take time to update after a push, so local verification is key).
