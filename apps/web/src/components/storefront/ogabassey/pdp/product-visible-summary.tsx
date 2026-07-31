interface OgabasseyPdpProductVisibleSummaryProps {
  summary: string | null;
}

export function OgabasseyPdpProductVisibleSummary({
  summary,
}: OgabasseyPdpProductVisibleSummaryProps) {
  if (!summary) return null;

  return <p data-ogabassey-pdp-visible-summary>{summary}</p>;
}
