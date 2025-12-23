---
description: Analyze PR comments, group them by theme, implement fixes, and draft responses.
---

This workflow guides the agent through the process of resolving PR comments *after* they have been extracted. It focuses on intelligent grouping, validation against 2025 best practices, and systematic execution.

**Prerequisites:**
- Run `/extract-pr-comments` first to generate the Todo list (e.g., `pr_119_review_todo.md`).

### 1. Context Acquisition
Before diving into fixes, build your mental model of the codebase.
- Read `project_brief.md` and `techstack.md` (if available) or key config files (`package.json`, `tsconfig.json`, `next.config.js`).
- Understand the "User Rules" regarding strict types, server actions, and security.

### 2. Triage & Grouping
Read the generated PR Todo list. Do **not** fix items one-by-one blindly.
- **Analyze**: Look for recurring themes (e.g., "Missing Zod validation", "Hardcoded Env Vars", "Unsafe `any` types").
- **Group**: Create a mental or scratchpad list of "Action Clusters".
  - *Example Cluster 1*: Fix all environment variable access in `scripts/*.ts`.
  - *Example Cluster 2*: Add error handling to server actions in `src/app/dashboard`.
- **Prioritize**: Identify "Critical" or "Major" issues first. Ignore "Trivial" nitpicks if they contradict the project coding style (but note *why* you ignored them).

### 3. Execution Loop (Per Cluster/Item)
For each identified Cluster or critical Item:

1.  **Validation**:
    - Open the relevant file(s).
    - Check if the comment is *technically valid* and *relevant* to the codebase context.
    - *Decision*: If the comment is outdated, invalid, or against project rules, **SKIP** the fix but note the reason for the response.

2.  **Implementation**:
    - Apply the fix using **2025 Best Practices** (React 19, Next.js 15+, Zod, Semantic HTML).
    - **Verify**: Run `npm run typecheck` or related scripts to ensure no regressions.

3.  **Documentation**:
    - Record what was done for the final response draft.

### 4. Draft Responses
Create a new artifact called `pr_[NUMBER]_response_draft.md`.
For each review comment (or group of comments), draft a polite and technical response for the GitHub PR.

**Format:**
```markdown
### `path/to/file.ts`
> [Commenter Name]: [Summary of their comment]

**Action**: Fixed / Wontfix
**Reply**:
"Added Zod validation schema as requested. Thanks!"
OR
"Skipped this change because we are explicitly using X pattern for legacy reasons..."
```

### 5. Final Review
- Notify the user that fixes are applied and the response draft is ready for their review.
