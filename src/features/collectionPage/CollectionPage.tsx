import { useEffect, useMemo, useState } from 'react';
import { checkCollectionReadiness } from '../collections';
import { addCardToCollection, getCollectionFilterOptions, loadCollectionPage, searchCardsCatalog } from './collectionPageService';
import {
  COLLECTION_PAGE_SIZE,
  type CardsCatalogSearchResult,
  type CollectionFilterOptions,
  type CollectionPageFilters,
  type CollectionPageState,
} from './collectionPageTypes';

const emptyCollectionPageFilters: CollectionPageFilters = {
  rarity: '',
  setCode: '',
};

const emptyCollectionFilterOptions: CollectionFilterOptions = {
  sets: [],
  rarities: [],
};

const filterLabels: Record<keyof CollectionPageFilters, string> = {
  rarity: 'rarity',
  setCode: 'set',
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
  const [filterOptions, setFilterOptions] = useState<CollectionFilterOptions>(emptyCollectionFilterOptions);
  const [filterOptionsError, setFilterOptionsError] = useState<string | null>(null);
  const [areFilterOptionsLoading, setAreFilterOptionsLoading] = useState(true);
  const [collectionPageState, setCollectionPageState] = useState<CollectionPageState>(initialCollectionPageState);
  const [catalogSearchTerm, setCatalogSearchTerm] = useState('');
  const [catalogResults, setCatalogResults] = useState<CardsCatalogSearchResult[]>([]);
  const [catalogSearchMessage, setCatalogSearchMessage] = useState('Voer minimaal 2 tekens in om kaarten te zoeken.');
  const [isCatalogSearching, setIsCatalogSearching] = useState(false);
  const [addCardMessage, setAddCardMessage] = useState<string | null>(null);
  const [addingCardId, setAddingCardId] = useState<string | null>(null);
  const [collectionRefreshKey, setCollectionRefreshKey] = useState(0);
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(collectionPageState.totalCount / collectionPageState.pageSize)),
    [collectionPageState.pageSize, collectionPageState.totalCount],
  );
  const setNameByCode = useMemo(
    () => new Map(filterOptions.sets.map((set) => [set.setCode, set.name])),
    [filterOptions.sets],
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
    let isMounted = true;

    setAreFilterOptionsLoading(true);
    checkCollectionReadiness()
      .then((collectionReadiness) => {
        const collectionId = collectionReadiness.mainCollection?.id;

        if (collectionReadiness.status !== 'collection-ready' || !collectionId) {
          return emptyCollectionFilterOptions;
        }

        return getCollectionFilterOptions(collectionId, filters);
      })
      .then((nextFilterOptions) => {
        if (!isMounted) {
          return;
        }

        setFilterOptions(nextFilterOptions);
        setFilterOptionsError(null);
        setAreFilterOptionsLoading(false);

        const selectedSetCode = filters.setCode?.trim() ?? '';
        const selectedRarity = filters.rarity?.trim() ?? '';
        const hasInvalidSelectedSet = selectedSetCode.length > 0 && !nextFilterOptions.sets.some((set) => set.setCode === selectedSetCode);
        const hasInvalidSelectedRarity = selectedRarity.length > 0 && !nextFilterOptions.rarities.includes(selectedRarity);

        if (hasInvalidSelectedSet || hasInvalidSelectedRarity) {
          setFilters((currentFilters) => {
            const currentSetCode = currentFilters.setCode?.trim() ?? '';
            const currentRarity = currentFilters.rarity?.trim() ?? '';
            const shouldClearSetCode = currentSetCode.length > 0 && !nextFilterOptions.sets.some((set) => set.setCode === currentSetCode);
            const shouldClearRarity = currentRarity.length > 0 && !nextFilterOptions.rarities.includes(currentRarity);

            if (!shouldClearSetCode && !shouldClearRarity) {
              return currentFilters;
            }

            setPage(1);

            return {
              ...currentFilters,
              setCode: shouldClearSetCode ? '' : currentFilters.setCode,
              rarity: shouldClearRarity ? '' : currentFilters.rarity,
            };
          });
        }
      })
      .catch((error: unknown) => {
        if (isMounted) {
          setFilterOptions(emptyCollectionFilterOptions);
          setFilterOptionsError(error instanceof Error ? error.message : 'Slimme collectiefilters laden is mislukt.');
          setAreFilterOptionsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [filters, collectionRefreshKey]);

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
  }, [activeSearchTerm, filters, page, collectionRefreshKey]);

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

  const runCatalogSearch = () => {
    const sanitizedSearchTerm = catalogSearchTerm.trim();

    if (sanitizedSearchTerm.length < 2) {
      setCatalogResults([]);
      setCatalogSearchMessage('Voer minimaal 2 tekens in om kaarten te zoeken.');
      return;
    }

    setIsCatalogSearching(true);
    setCatalogSearchMessage('Kaarten zoeken...');
    searchCardsCatalog(sanitizedSearchTerm)
      .then((results) => {
        setCatalogResults(results);
        setCatalogSearchMessage(results.length > 0 ? `${results.length} resultaten gevonden.` : 'Geen kaarten gevonden.');
      })
      .catch((error: unknown) => {
        setCatalogResults([]);
        setCatalogSearchMessage(error instanceof Error ? error.message : 'Kaarten zoeken is mislukt.');
      })
      .finally(() => {
        setIsCatalogSearching(false);
      });
  };

  const clearCatalogSearch = () => {
    setCatalogSearchTerm('');
    setCatalogResults([]);
    setCatalogSearchMessage('Voer minimaal 2 tekens in om kaarten te zoeken.');
    setAddCardMessage(null);
  };

  const addCatalogCard = (cardCatalogId: string) => {
    setAddingCardId(cardCatalogId);
    setAddCardMessage(null);
    addCardToCollection(cardCatalogId)
      .then((result) => {
        setAddCardMessage(result.message);

        if (result.status === 'added') {
          setCollectionRefreshKey((currentKey) => currentKey + 1);
        }
      })
      .catch((error: unknown) => {
        setAddCardMessage(error instanceof Error ? error.message : 'Kaart toevoegen is mislukt.');
      })
      .finally(() => {
        setAddingCardId(null);
      });
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

      <section className="collection-page-add-card" aria-labelledby="collection-page-add-card-title">
        <h3 id="collection-page-add-card-title">Kaart toevoegen</h3>
        <p>Zoek in de kaartcatalogus en voeg één kaart toe aan je actieve hoofdcollectie.</p>
        <div className="collection-page-search-control collection-page-add-card-search">
          <label className="sr-only" htmlFor="collection-page-add-card-input">Kaart zoeken in catalogus</label>
          <input
            id="collection-page-add-card-input"
            type="search"
            value={catalogSearchTerm}
            placeholder="Zoek op Pokémon, set of nummer"
            onChange={(event) => setCatalogSearchTerm(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                runCatalogSearch();
              }
            }}
          />
          <button type="button" onClick={runCatalogSearch} disabled={isCatalogSearching}>
            Zoek
          </button>
          <button type="button" onClick={clearCatalogSearch} disabled={catalogSearchTerm.length === 0 && catalogResults.length === 0}>
            Clear
          </button>
        </div>
        <p className="status-note" role="status">{catalogSearchMessage}</p>
        {addCardMessage ? <p className="status-note" role="status">{addCardMessage}</p> : null}
        {catalogResults.length > 0 ? (
          <ul className="collection-page-add-card-results" aria-label="Catalogus zoekresultaten">
            {catalogResults.map((card) => (
              <li key={card.id}>
                {card.imageSmall ? (
                  <img src={card.imageSmall} alt={card.pokemon ? `${card.pokemon} kaart` : 'Cataloguskaart'} loading="lazy" />
                ) : (
                  <div className="card-image-placeholder" aria-label="Geen afbeelding beschikbaar">Geen afbeelding</div>
                )}
                <div>
                  <h4>{formatValue(card.pokemon)}</h4>
                  <p>{formatValue(card.setName)} · #{formatValue(card.number)}</p>
                  {card.rarity ? <p>{card.rarity}</p> : null}
                </div>
                <button type="button" onClick={() => addCatalogCard(card.id)} disabled={addingCardId === card.id}>
                  {addingCardId === card.id ? 'Toevoegen...' : 'Toevoegen'}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

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
            <select value={filters.rarity ?? ''} onChange={(event) => updateFilter('rarity', event.target.value)} disabled={areFilterOptionsLoading && filterOptions.rarities.length === 0}>
              <option value="">Alle rarities</option>
              {filterOptions.rarities.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>
          <label>
            Set
            <select value={filters.setCode ?? ''} onChange={(event) => updateFilter('setCode', event.target.value)} disabled={areFilterOptionsLoading && filterOptions.sets.length === 0}>
              <option value="">Alle sets</option>
              {filterOptions.sets.map((set) => (
                <option key={set.setCode} value={set.setCode}>{set.name}</option>
              ))}
            </select>
          </label>
        </div>
        {filterOptionsError ? <p className="status-note">Slimme filters laden is mislukt: {filterOptionsError}</p> : null}
        <div className="collection-page-filter-actions">
          <button type="button" onClick={clearFilters} disabled={!hasActiveFilters}>Reset filters</button>
          {hasActiveCriteria ? <button type="button" onClick={clearAllCriteria}>Alles wissen</button> : null}
        </div>
        {hasActiveCriteria ? (
          <p className="collection-page-search-summary">
            Resultaten gefilterd op:{' '}
            {[hasActiveSearch ? `search = ${activeSearchTerm}` : null, ...activeFilterEntries.map(([name, value]) => `${filterLabels[name]} = ${name === 'setCode' ? setNameByCode.get(value) ?? 'Onbekende set' : value}`)]
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
