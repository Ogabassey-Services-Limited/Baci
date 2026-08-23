#!/usr/bin/env bash

# The applier sources this exact source/repair/checksum mapping before it can
# register any historical migration. Each entry is immutable by checksum so a
# later edit cannot silently substitute a repair for different failed bytes.
historical_migration_repair_spec() {
  case "$1:$2" in
    20260727220050:shipment_tracking_realtime_broadcast)
      printf '%s\t%s\t%s\n' '20260803000600' 'repair_gigl_tracking_realtime_broadcast' '89b2dafdf9de92770d8a20151444a6c34602f78cb83bcc79cb20ed3ea9c21b65'
      ;;
    20260801141800:harden_gigl_tracking_retry_edges)
      printf '%s\t%s\t%s\n' '20260803000700' 'repair_gigl_tracking_retry_edges' '35bcfb114ccfdadbbb44f69b21b53dd91b8df7a9eaa875f364e3d22b354801d1'
      ;;
    20260801141900:scope_gigl_recovery_to_failed_event)
      printf '%s\t%s\t%s\n' '20260804000100' 'repair_gigl_failed_event_recovery_scope' '972030071dbeea262fdd1ccc20f4f62c07c90299d00e5fd70335617c4dd9a91d'
      ;;
    20260801142000:harden_gigl_notification_recovery_edges)
      printf '%s\t%s\t%s\n' '20260804000400' 'repair_gigl_notification_terminality_cardinality' 'b373ae3f70d7311004e7e4400c2b3a3c8534300e82ee01c2c9e0d3df2680b81e'
      ;;
    20260801142100:preserve_manual_gigl_failures_after_unknown_scans)
      printf '%s\t%s\t%s\n' '20260804000300' 'repair_gigl_manual_failure_status_scope' 'f97c32889ae2e733d881bd7d6672cd91337936326f55e205d717bb972398ea73'
      ;;
    20260801142200:cleanup_unowned_gigl_monitor_backfill)
      printf '%s\t%s\t%s\n' '20260804000500' 'repair_gigl_monitor_backfill_join' '605a0d48a4f116e67ee626ff173b66c6c80cefa77ad606a3813aa1ea6deda62a'
      ;;
    *) return 1 ;;
  esac
}

# An unpublished repair can itself be malformed. Keep it immutable and skip it
# only after the historical source and its corrected replacement are recorded.
historical_migration_repair_supersession_spec() {
  case "$1:$2" in
    20260804000200:repair_gigl_notification_recovery_edges)
      printf '%s\t%s\t%s\t%s\n' '20260801142000' 'harden_gigl_notification_recovery_edges' '20260804000400' 'repair_gigl_notification_terminality_cardinality'
      ;;
    *) return 1 ;;
  esac
}

historical_collision_repair_spec() {
  case "$1:$2" in
    20260615120000:customer_order_cancellation)
      printf '%s\t%s\n' '20260616205500' 'return_registered_push_token_id'
      ;;
    20260713130000:add_storefront_paystack_subaccount_configured_rpc)
      printf '%s\t%s\n' '20260713140000' 'quiz_finalize_rank_winners_reapply'
      ;;
    20260805090000:add_least_privilege_gigl_tracking_worker | \
    20260805090000:complete_merchant_invoice_partial_payments)
      printf '%s\t%s\n' '20260805090002' 'reapply_complete_merchant_invoice_partial_payment'
      ;;
    20260811120000:quiz_leaderboard_and_claim_projections_v2)
      printf '%s\t%s\n' '20260811130001' 'reapply_paystack_email_mismatch'
      ;;
    20260811120000:allow_reviewed_paystack_email_mismatch)
      printf '%s\t%s\n' '20260811130001' 'reapply_paystack_email_mismatch'
      ;;
    *) return 1 ;;
  esac
}

historical_collision_version_is_known() {
  case "$1" in
    20260615120000 | 20260713130000 | 20260805090000 | 20260811120000) return 0 ;;
    *) return 1 ;;
  esac
}

historical_collision_name_is_valid() {
  case "$1:$2" in
    20260615120000:customer_order_cancellation | \
    20260615120000:register_push_token_rpc | \
    20260713130000:add_storefront_paystack_subaccount_configured_rpc | \
    20260713130000:quiz_finalize_rank_winners | \
    20260805090000:add_least_privilege_gigl_tracking_worker | \
    20260805090000:complete_merchant_invoice_partial_payments)
      return 0
      ;;
    20260811120000:quiz_leaderboard_and_claim_projections_v2 | \
    20260811120000:allow_reviewed_paystack_email_mismatch)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

historical_name_alias_is_valid() {
  case "$1:$2:$3" in
    20260604132853:fix_storefront_order_customer_returning_id_ambiguity:fix_create_storefront_order_customer_returning_id_ambiguity)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}
