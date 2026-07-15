export type BinderCardGridItem = {
  id: string;
  imageSmall: string | null;
  label: string;
  isPresent?: boolean;
};

type BinderCardGridProps = {
  items: BinderCardGridItem[];
  ariaLabel: string;
  onSelect: (id: string) => void;
  getButtonRef?: (id: string, element: HTMLButtonElement | null) => void;
};

export function BinderCardGrid({ items, ariaLabel, onSelect, getButtonRef }: BinderCardGridProps) {
  return (
    <ul className="binder-card-grid" aria-label={ariaLabel}>
      {items.map((item) => (
        <li key={item.id} className="binder-card-grid-item">
          <button ref={(element) => getButtonRef?.(item.id, element)} type="button" className="binder-card-grid-button" aria-label={item.label} onClick={() => onSelect(item.id)}>
            {item.imageSmall ? <img src={item.imageSmall} alt="" width="120" height="168" loading="lazy" decoding="async" /> : <span className="binder-card-grid-placeholder" aria-hidden="true" />}
            {item.isPresent ? <span className="binder-card-grid-present-marker" aria-hidden="true">✓</span> : null}
          </button>
        </li>
      ))}
    </ul>
  );
}
