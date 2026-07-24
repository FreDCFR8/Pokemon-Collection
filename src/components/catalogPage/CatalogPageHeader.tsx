import type { KeyboardEvent, ReactNode } from 'react';

type CatalogPageHeaderProps = {
  ariaLabel: string;
  children: ReactNode;
  errorMessage?: string;
  headerAction?: ReactNode;
  hasActiveCriteria: boolean;
  id: string;
  message?: string;
  onClearAll: () => void;
  onClearSearch: () => void;
  onSearchChange: (value: string) => void;
  onSearchSubmit?: () => void;
  searchAriaLabel: string;
  searchPlaceholder: string;
  searchSummary?: string;
  searchTerm: string;
  status?: string;
  subtitle?: string;
  title: string;
};

export function CatalogPageHeader({
  ariaLabel, children, errorMessage, headerAction, hasActiveCriteria, id, message, onClearAll, onClearSearch,
  onSearchChange, onSearchSubmit, searchAriaLabel, searchPlaceholder, searchSummary, searchTerm, status = 'ready', subtitle, title,
}: CatalogPageHeaderProps) {
  const submitOnEnter = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && onSearchSubmit) {
      event.preventDefault();
      onSearchSubmit();
    }
  };

  return (
    <>
      <header className="catalog-page-header">
        <h2 id={id}>
          <span aria-hidden="true">✦</span>
          <strong>{title}</strong>
          {subtitle ? <em>{subtitle}</em> : null}
          <span aria-hidden="true">✦</span>
        </h2>
        {status !== 'ready' && message ? <p className="catalog-page-status">{message}</p> : null}
        {errorMessage ? <p className="status-note">Foutmelding: {errorMessage}</p> : null}
        {headerAction}
      </header>
      <div className="catalog-page-toolbar">
        <div className="catalog-page-search-control">
          <span className="catalog-page-search-icon" aria-hidden="true">⌕</span>
          <input id={`${id}-search-input`} type="search" aria-label={searchAriaLabel} value={searchTerm} placeholder={searchPlaceholder} onChange={(event) => onSearchChange(event.target.value)} onKeyDown={submitOnEnter} />
          {searchTerm ? <button type="button" className="catalog-page-search-clear" aria-label="Zoekterm wissen" onClick={onClearSearch}>×</button> : null}
        </div>
        <div className="catalog-page-filter-row" aria-label={ariaLabel}>
          <button type="button" className="catalog-page-clear-filters" aria-label="Zoekopdracht en filters wissen" onClick={onClearAll} disabled={!hasActiveCriteria}>×</button>
          {children}
        </div>
        {searchSummary ? <p className="catalog-page-search-summary">{searchSummary}</p> : null}
      </div>
    </>
  );
}
