Investigate the reported issue thoroughly:

1. Search for the relevant code using the description: $ARGUMENTS
2. Trace the data flow from UI to API to database
3. Check for recent changes that might have introduced the issue (git log)
4. Look for error patterns in the code
5. Identify the root cause
6. Propose a fix with minimal blast radius
7. Identify what tests should be added to prevent regression

Report findings as:
- **Root Cause**: What is actually wrong
- **Evidence**: Code paths and data flow showing the issue
- **Fix**: Minimal, targeted code change
- **Prevention**: Test(s) to add
