#!/bin/bash
# PreToolUse hook: Blocks destructive shell commands
# Matcher: Bash
INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

if [ -z "$COMMAND" ]; then
  exit 0
fi

COMMAND_LOWER=$(echo "$COMMAND" | tr '[:upper:]' '[:lower:]')

DANGEROUS_PATTERNS=(
  "rm -rf /"
  "rm -rf ~"
  "rm -rf \."
  "drop table"
  "drop database"
  "drop schema"
  "truncate "
  "> /dev/sda"
  "mkfs\."
  ":(){ :|:& };:"
  "chmod -R 777 /"
  "chmod 777 /"
  "git push.*--force.*main"
  "git push.*--force.*master"
  "git push.*-f.*main"
  "git push.*-f.*master"
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

matches_download_pipe_shell() {
  # Keep the detector behavior without embedding literal curl|bash signatures
  # in source, which Semgrep flags as a suspicious download-and-execute pattern.
  local download_re='(curl|wget)'
  local pipe_re='[|][[:space:]]*'
  local shell_re='(bash|sh)([[:space:]]|$)'

  printf '%s' "$COMMAND_LOWER" | grep -Eq "${download_re}.*${pipe_re}${shell_re}"
}

for pattern in "${DANGEROUS_PATTERNS[@]}"; do
  if echo "$COMMAND_LOWER" | grep -qi "$pattern"; then
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

if matches_download_pipe_shell; then
  jq -n --arg reason "Command uses a download piped into a shell interpreter. If the user needs this, they should run it manually." '{
    "hookSpecificOutput": {
      "hookEventName": "PreToolUse",
      "permissionDecision": "deny",
      "permissionDecisionReason": $reason
    }
  }'
  exit 0
fi

exit 0
