/**
 * The minimal colour contract the checkout selection primitives consume. Both
 * the full theme (`Colors.light`) and any card-specific colour subset satisfy
 * it, so the primitives can be shared across payment and delivery without
 * forcing every caller to pass the entire theme object.
 */
export interface SelectionColors {
  card: string;
  background: string;
  border: string;
  text: string;
  textSecondary: string;
}
