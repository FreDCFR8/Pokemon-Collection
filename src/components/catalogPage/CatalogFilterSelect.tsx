type CatalogFilterSelectOption = { value: string; label: string };

type CatalogFilterSelectProps = {
  ariaLabel: string;
  disabled?: boolean;
  label: string;
  onChange: (value: string) => void;
  options: CatalogFilterSelectOption[];
  value: string;
};

export function CatalogFilterSelect({ ariaLabel, disabled = false, label, onChange, options, value }: CatalogFilterSelectProps) {
  return (
    <label className="catalog-page-filter-select">
      <span className="sr-only">{label}</span>
      <select value={value} aria-label={ariaLabel} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
        <option value="">{label}</option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}
