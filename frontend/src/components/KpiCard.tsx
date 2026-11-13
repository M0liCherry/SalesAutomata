import { Icon, type IconName } from "./Icon";

export function KpiCard({
  label,
  value,
  hint,
  icon,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: IconName;
  tone?: "neutral" | "info" | "success" | "warning" | "danger" | "accent";
}) {
  return (
    <article className={`kpi-card kpi-card--${tone}`}>
      <div className="kpi-card__top">
        <span className="kpi-card__label">{label}</span>
        <span className="kpi-card__icon">
          <Icon name={icon} size={17} />
        </span>
      </div>
      <strong className="kpi-card__value">{value}</strong>
      {hint ? <span className="kpi-card__hint">{hint}</span> : null}
    </article>
  );
}
