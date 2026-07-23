// Expected physical duplicate groups, extracted from the manifest test (Codex
// #3171) to keep the binding test under the 300-line gate.
export const EXPECTED_DUPLICATE_GROUPS = [
  {
    version: '20260615120000',
    sources: [
      [
        'supabase/migrations/20260615120000_customer_order_cancellation.sql',
        'acb7406d4975c5cd8d3964e86b991b51046b6f750d49b3769699b878b92192d3',
      ],
      [
        'supabase/migrations/20260615120000_register_push_token_rpc.sql',
        '6000b0006539041c1bd914567ebcbc31eb15e8f14401ae488d0a609ce74b4293',
      ],
    ],
  },
  {
    version: '20260713130000',
    sources: [
      [
        'supabase/migrations/20260713130000_add_storefront_paystack_subaccount_configured_rpc.sql',
        '9cb95f8ba9ebd75568b9b5c7ee17521981465fa330d18a76ed467a179dd79645',
      ],
      [
        'supabase/migrations/20260713130000_quiz_finalize_rank_winners.sql',
        '3140c3a76b2cd6ca1952dc166cd5e010d15c7070fde0647e41ad9bfc7d400ab2',
      ],
    ],
    uniqueReapply: [
      'supabase/migrations/20260713140000_quiz_finalize_rank_winners_reapply.sql',
      'f3461eead2451852ecc9a643f34ca486207ea6b10b8ef3439e69718e738acd8c',
    ],
  },
];
