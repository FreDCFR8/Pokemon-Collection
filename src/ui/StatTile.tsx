type StatTileProps = {
  label: string;
  value: number | string;
};

export function StatTile({ label, value }: StatTileProps) {
  return (
    <article className="ui-stat-tile">
      <span className="ui-stat-tile__label">{label}</span>
      <strong className="ui-stat-tile__value">{value}</strong>
    </article>
  );
}
