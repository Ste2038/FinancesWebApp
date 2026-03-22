type SummaryCardProps = {
  label: string;
  value: string;
  delta: string;
  tone?: "default" | "accent" | "warning";
};

export function SummaryCard({
  label,
  value,
  delta,
  tone = "default"
}: SummaryCardProps) {
  return (
    <article className={`summary-card summary-card--${tone}`}>
      <span className="summary-card__label">{label}</span>
      <strong>{value}</strong>
      <p>{delta}</p>
    </article>
  );
}
