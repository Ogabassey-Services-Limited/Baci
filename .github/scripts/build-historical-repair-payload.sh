#!/usr/bin/env bash

set -euo pipefail

repair_file="$1"
original_registration="$2"
repair_registration="$3"

jq -n \
  --rawfile sql "$repair_file" \
  --arg original_registration "$original_registration" \
  --arg repair_registration "$repair_registration" \
  --arg prefix "BEGIN;
SET LOCAL lock_timeout = '30s';
" \
  '{
     query: (
       $prefix
       + $sql
       + "\n"
       + $original_registration
       + "\n"
       + $repair_registration
       + "\nCOMMIT;"
     )
   }'
