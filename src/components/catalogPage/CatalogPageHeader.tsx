import type { ReactNode } from 'react';

type CatalogPageHeaderProps = {
  title: string;
  titleId: string;
  subtitle?: string;
  statusMessage?: string;
  errorMessage?: string;
  headerAction?: ReactNode;
  searchId: string;
  searchLabel: string;
  searchPlaceholder: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onSearchClear: () => void;
  onSearchSubmit?: () => void;
  hasActiveCriteria: boolean;
  onClearAll: () => void;
  filters: ReactNode;
  toolbarFooter?: ReactNode;
};

type CatalogFilterOption = {
  label: string;
  value: string;
};

type CatalogFilterSelectProps = {
  ariaLabel: string;
  label: string;
  value: string;
  options: CatalogFilterOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
};

export function CatalogFilterSelect({
  ariaLabel,
  label,
  value,
  options,
  onChange,
  disabled = false,
}: CatalogFilterSelectProps) {
  return (
    <label className="catalog-page-filter">
      <span className="sr-only">{ariaLabel}</span>
      <select
        value={value}
        aria-label={ariaLabel}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      >
        <option value="">{label}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

export function CatalogPageHeader({
  title,
  titleId,
  subtitle,
  statusMessage,
  errorMessage,
  headerAction,
  searchId,
  searchLabel,
  searchPlaceholder,
  searchValue,
  onSearchChange,
  onSearchClear,
  onSearchSubmit,
  hasActiveCriteria,
  onClearAll,
  filters,
  toolbarFooter,
}: CatalogPageHeaderProps) {
  return (
    <>
      <header className="catalog-page-header">
        <h2 id={titleId}>
          <span aria-hidden="true">✦</span>
          <strong>{title}</strong>
          {subtitle ? <em>{subtitle}</em> : null}
          <span aria-hidden="true">✦</span>
        </h2>
        {statusMessage ? <p className="catalog-page-status">{statusMessage}</p> : null}
        {errorMessage ? <p className="status-note">Foutmelding: {errorMessage}</p> : null}
        {headerAction}
      </header>

      <div className="catalog-page-toolbar">
        <div className="catalog-page-search-control">
          <span className="catalog-page-search-icon" aria-hidden="true">⌕</span>
          <input
            id={searchId}
            type="search"
            aria-label={searchLabel}
            value={searchValue}
            placeholder={searchPlaceholder}
            onChange={(event) => onSearchChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && onSearchSubmit) {
                event.preventDefault();
                onSearchSubmit();
              }
            }}
          />
          {searchValue.length > 0 ? (
            <button type="button" className="catalog-page-search-clear" aria-label="Zoekterm wissen" onClick={onSearchClear}>×</button>
          ) : null}
        </div>

        <div className="catalog-page-filter-row" aria-label={`${title} filters`}>
          <button
            type="button"
            className="catalog-page-clear-filters"
            aria-label="Zoekopdracht en filters wissen"
            onClick={onClearAll}
            disabled={!hasActiveCriteria}
          >
            ×
          </button>
          {filters}
        </div>

        {toolbarFooter}
      </div>
    </>
  );
}
