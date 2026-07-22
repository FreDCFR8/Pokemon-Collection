type StatTileProps = {
  className?: string;
  label: string;
  value: number | string;
};

export function StatTile({ className = '', label, value }: StatTileProps) {
  return (
    <article className={`ui-stat-tile ${className}`.trim()}>
      <span className="ui-stat-tile__label">{label}</span>
      <strong className="ui-stat-tile__value">{value}</strong>
    </article>
  );
}
