import { useEffect, useMemo, useState } from 'react';
import { loadCollectionPage } from './collectionPageService';
import { COLLECTION_PAGE_SIZE, type CollectionPageFilters, type CollectionPageState } from './collectionPageTypes';

const emptyCollectionPageFilters: CollectionPageFilters = {
  rarity: '',
  condition: '',
  status: '',
};

const rarityFilterOptions = ['', 'Common', 'Uncommon', 'Rare', 'Rare Holo', 'Ultra Rare', 'Secret Rare', 'Promo', 'Other'];
const conditionFilterOptions = ['', 'mint', 'near_mint', 'excellent', 'good', 'played', 'poor', 'unknown', 'Other'];
const statusFilterOptions = ['', 'owned', 'wanted', 'duplicate', 'traded', 'sold', 'unknown', 'Other'];

const filterLabels: Record<keyof CollectionPageFilters, string> = {
  rarity: 'rarity',
  condition: 'condition',
  status: 'status',
};

const initialCollectionPageState: CollectionPageState = {
  status: 'loading',
  message: 'Collectiepagina wordt voorbereid.',
  totalCount: 0,
  page: 1,
  pageSize: COLLECTION_PAGE_SIZE,
  cards: [],
};

function formatValue(value: string | number | null): string {
  if (value === null || value === '') {
    return '—';
  }

  return String(value);
}

type CollectionPaginationProps = {
  currentPage: number;
  isLoading: boolean;
  label: string;
  onNextPage: () => void;
  onPreviousPage: () => void;
  totalPages: number;
};

function CollectionPagination({
  currentPage,
  isLoading,
  label,
  onNextPage,
  onPreviousPage,
  totalPages,
}: CollectionPaginationProps) {
  return (
    <nav className="collection-page-pagination" aria-label={label}>
      <button type="button" onClick={onPreviousPage} disabled={isLoading || currentPage <= 1}>
        Previous
      </button>
      <span>
        Pagina {currentPage} van {totalPages}
      </span>
      <button type="button" onClick={onNextPage} disabled={isLoading || currentPage >= totalPages}>
        Next
      </button>
    </nav>
  );
}

export function CollectionPage() {
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSearchTerm, setActiveSearchTerm] = useState('');
  const [filters, setFilters] = useState<CollectionPageFilters>(emptyCollectionPageFilters);
  const [collectionPageState, setCollectionPageState] = useState<CollectionPageState>(initialCollectionPageState);
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(collectionPageState.totalCount / collectionPageState.pageSize)),
    [collectionPageState.pageSize, collectionPageState.totalCount],
  );
  const isLoading = collectionPageState.status === 'loading';
  const trimmedSearchTerm = searchTerm.trim();
  const hasActiveSearch = activeSearchTerm.trim().length > 0;
  const activeFilterEntries = Object.entries(filters).filter((entry): entry is [keyof CollectionPageFilters, string] => entry[1] !== undefined && entry[1].trim().length > 0);
  const hasActiveFilters = activeFilterEntries.length > 0;
  const hasActiveCriteria = hasActiveSearch || hasActiveFilters;
  const firstVisibleCard = collectionPageState.totalCount === 0 ? 0 : (collectionPageState.page - 1) * collectionPageState.pageSize + 1;
  const lastVisibleCard = Math.min(collectionPageState.page * collectionPageState.pageSize, collectionPageState.totalCount);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setPage(1);
      setActiveSearchTerm(trimmedSearchTerm);
    }, 400);

    return () => window.clearTimeout(timeoutId);
  }, [trimmedSearchTerm]);

  useEffect(() => {
    let isMounted = true;

    setCollectionPageState(initialCollectionPageState);
    loadCollectionPage(page, { searchQuery: activeSearchTerm, filters }).then((nextState) => {
      if (isMounted) {
        setCollectionPageState(nextState);
        setPage(nextState.page);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [activeSearchTerm, filters, page]);

  const applySearchImmediately = () => {
    setPage(1);
    setActiveSearchTerm(trimmedSearchTerm);
  };

  const clearSearch = () => {
    setSearchTerm('');
    setPage(1);
    setActiveSearchTerm('');
  };

  const updateFilter = (filterName: keyof CollectionPageFilters, value: string) => {
    setFilters((currentFilters) => ({
      ...currentFilters,
      [filterName]: value,
    }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters(emptyCollectionPageFilters);
    setPage(1);
  };

  const clearAllCriteria = () => {
    setSearchTerm('');
    setActiveSearchTerm('');
    setFilters(emptyCollectionPageFilters);
    setPage(1);
  };

  const goToPreviousPage = () => setPage((currentPage) => Math.max(1, currentPage - 1));
  const goToNextPage = () => setPage((currentPage) => Math.min(totalPages, currentPage + 1));

  return (
    <section className="collection-page" aria-labelledby="collection-page-title">
      <div className="collection-page-header">
        <div>
          <p className="eyebrow">Read-only main collection</p>
          <h2 id="collection-page-title">Collection</h2>
          <p>{collectionPageState.message}</p>
          {collectionPageState.errorMessage ? <p className="status-note">Foutmelding: {collectionPageState.errorMessage}</p> : null}
        </div>
      </div>

      <dl className="collection-page-summary" aria-label="Collectie samenvatting">
        <div>
          <dt>Totaal kaarten</dt>
          <dd>{collectionPageState.totalCount}</dd>
        </div>
        <div>
          <dt>Zichtbaar</dt>
          <dd>
            {firstVisibleCard}–{lastVisibleCard}
          </dd>
        </div>
        <div>
          <dt>Pagina</dt>
          <dd>
            {collectionPageState.page} / {totalPages}
          </dd>
        </div>
        <div>
          <dt>Per pagina</dt>
          <dd>{collectionPageState.pageSize}</dd>
        </div>
      </dl>

      <p className="collection-page-legacy-note">Legacy collectiegegevens worden hier rustig read-only getoond; bewerken en importeren blijven buiten deze fase.</p>

      <div className="collection-page-search">
        <label htmlFor="collection-page-search-input">Collectie zoeken</label>
        <div className="collection-page-search-control">
          <input
            id="collection-page-search-input"
            type="search"
            value={searchTerm}
            placeholder="Zoek op Pokémon, set of nummer"
            onChange={(event) => setSearchTerm(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                applySearchImmediately();
              }
            }}
          />
          {searchTerm.length > 0 ? (
            <button type="button" aria-label="Zoekterm wissen" onClick={clearSearch}>
              ×
            </button>
          ) : null}
        </div>
        <div className="collection-page-filters" aria-label="Collectiefilters">
          <label>
            Rarity
            <select value={filters.rarity ?? ''} onChange={(event) => updateFilter('rarity', event.target.value)}>
              {rarityFilterOptions.map((option) => (
                <option key={option || 'all-rarity'} value={option}>{option || 'Alle'}</option>
              ))}
            </select>
          </label>
          <label>
            Condition
            <select value={filters.condition ?? ''} onChange={(event) => updateFilter('condition', event.target.value)}>
              {conditionFilterOptions.map((option) => (
                <option key={option || 'all-condition'} value={option}>{option || 'Alle'}</option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select value={filters.status ?? ''} onChange={(event) => updateFilter('status', event.target.value)}>
              {statusFilterOptions.map((option) => (
                <option key={option || 'all-status'} value={option}>{option || 'Alle'}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="collection-page-filter-actions">
          <button type="button" onClick={clearFilters} disabled={!hasActiveFilters}>Reset filters</button>
          {hasActiveCriteria ? <button type="button" onClick={clearAllCriteria}>Alles wissen</button> : null}
        </div>
        {hasActiveCriteria ? (
          <p className="collection-page-search-summary">
            Resultaten gefilterd op:{' '}
            {[hasActiveSearch ? `search = ${activeSearchTerm}` : null, ...activeFilterEntries.map(([name, value]) => `${filterLabels[name]} = ${value}`)]
              .filter(Boolean)
              .join(', ')}
          </p>
        ) : null}
      </div>

      <CollectionPagination
        currentPage={collectionPageState.page}
        isLoading={isLoading}
        label="Collectiepaginatie boven"
        onNextPage={goToNextPage}
        onPreviousPage={goToPreviousPage}
        totalPages={totalPages}
      />

      {collectionPageState.status === 'ready' && collectionPageState.cards.length === 0 ? (
        <div className="collection-page-empty">
          <p>{hasActiveCriteria ? 'Geen kaarten gevonden voor deze zoekopdracht en filters.' : 'Nog geen kaarten in deze collectie.'}</p>
          {hasActiveCriteria ? (
            <button type="button" onClick={clearAllCriteria}>
              Zoekopdracht en filters wissen
            </button>
          ) : null}
        </div>
      ) : null}

      {collectionPageState.cards.length > 0 ? (
        <>
          <ul className="collection-page-grid" aria-label="Collectiekaarten">
            {collectionPageState.cards.map((card, index) => (
              <li key={`${card.pokemon ?? 'kaart'}-${card.setName ?? 'set'}-${card.number ?? index}-${index}`}>
                {card.imageSmall ? (
                  <img src={card.imageSmall} alt={card.pokemon ? `${card.pokemon} kaart` : 'Collectiekaart'} loading="lazy" />
                ) : (
                  <div className="card-image-placeholder" aria-label="Geen afbeelding beschikbaar">
                    Geen afbeelding
                  </div>
                )}
                <div className="collection-page-card-body">
                  <h3>{formatValue(card.pokemon)}</h3>
                  <p>{formatValue(card.setName)} · #{formatValue(card.number)}</p>
                  <dl className="collection-page-card-meta">
                    <div><dt>Rarity</dt><dd>{formatValue(card.rarity)}</dd></div>
                    <div><dt>Aantal</dt><dd>{formatValue(card.quantity)}</dd></div>
                    <div><dt>Conditie</dt><dd>{formatValue(card.condition)}</dd></div>
                    <div><dt>Status</dt><dd>{formatValue(card.status)}</dd></div>
                  </dl>
                </div>
              </li>
            ))}
          </ul>

          <CollectionPagination
            currentPage={collectionPageState.page}
            isLoading={isLoading}
            label="Collectiepaginatie onder"
            onNextPage={goToNextPage}
            onPreviousPage={goToPreviousPage}
            totalPages={totalPages}
          />
        </>
      ) : null}
    </section>
  );
}
