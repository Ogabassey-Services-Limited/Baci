#!/bin/bash
# PreToolUse hook: Blocks destructive shell commands
# Matcher: Bash
INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

if [ -z "$COMMAND" ]; then
  exit 0
fi

COMMAND_LOWER=$(echo "$COMMAND" | tr '[:upper:]' '[:lower:]')

# Fixed-string patterns (matched literally with grep -qFi)
DANGEROUS_FIXED=(
  "rm -rf /"
  "rm -rf ~"
  "rm -rf \."
  "drop table"
  "drop database"
  "drop schema"
  "truncate "
  "> /dev/sda"
  ":(){ :|:& };:"
  "chmod -R 777 /"
  "chmod 777 /"
  "git reset --hard"
  "git clean -fd"
  "git clean -f "
  "npx supabase db reset"
  "sudo "
  "eval "
  "shutdown "
  "reboot"
  "git add .env"
  "git add *.env"
)

# Regex patterns (matched with grep -qEi)
DANGEROUS_REGEX=(
  "mkfs\."
  "curl.*\| *bash"
  "curl.*\| *sh"
  "wget.*\| *bash"
  "wget.*\| *sh"
  "git push.*--force.*main"
  "git push.*--force.*master"
  "git push.*-f.*main"
  "git push.*-f.*master"
)

for pattern in "${DANGEROUS_FIXED[@]}"; do
  if echo "$COMMAND_LOWER" | grep -qFi "$pattern"; then
    jq -n --arg reason "Command matches dangerous pattern '$pattern'. If the user needs this, they should run it manually." '{
      "hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": "deny",
        "permissionDecisionReason": $reason
      }
    }'
    exit 0
  fi
done

for pattern in "${DANGEROUS_REGEX[@]}"; do
  if echo "$COMMAND_LOWER" | grep -qEi "$pattern"; then
    jq -n --arg reason "Command matches dangerous pattern '$pattern'. If the user needs this, they should run it manually." '{
      "hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": "deny",
        "permissionDecisionReason": $reason
      }
    }'
    exit 0
  fi
done

exit 0
