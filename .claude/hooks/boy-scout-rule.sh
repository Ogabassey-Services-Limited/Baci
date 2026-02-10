#!/bin/bash
# PostToolUse hook: Boy Scout Rule — nudge when editing files over 300 lines
# Non-blocking: outputs a reminder, does NOT prevent the edit.
# Only fires for .ts/.tsx files in source directories.

INPUT=$(cat)

# Extract file path from the tool input
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.filePath // empty' 2>/dev/null)
[ -z "$FILE_PATH" ] && exit 0

# Only check TypeScript source files
case "$FILE_PATH" in
  *.ts|*.tsx) ;;
  *) exit 0 ;;
esac

# Only check files in source directories
case "$FILE_PATH" in
  */src/*|*/app/*|*/components/*|*/lib/*|*/hooks/*|*/store/*|*/schemas/*) ;;
  *) exit 0 ;;
esac

# Skip test files
case "$(basename "$FILE_PATH")" in
  *.test.ts|*.test.tsx|*.spec.ts|*.spec.tsx) exit 0 ;;
esac

# Count lines
[ ! -f "$FILE_PATH" ] && exit 0
LINES=$(wc -l < "$FILE_PATH" | tr -d ' ')

if [ "$LINES" -gt 300 ]; then
  echo "Boy Scout Rule: This file is ${LINES} lines (limit: 300). Consider extracting logic you touched into smaller files (hooks, utils, sub-components)."
fi

exit 0
