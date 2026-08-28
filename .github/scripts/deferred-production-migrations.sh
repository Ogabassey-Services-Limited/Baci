#!/usr/bin/env bash

# Migrations listed here install database enforcement that depends on the
# matching application revision already serving traffic. The pre-deploy phase
# skips them; the deploy job applies them immediately after the new revision is
# live. Keep this list explicit and short so unrelated schema migrations still
# run before application deployment.
is_postdeploy_migration() {
  case "$1" in
    20260828090000_harden_storefront_order_rpc_context_and_replays|20260828100000_allow_legacy_quiz_award_order_context)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}
