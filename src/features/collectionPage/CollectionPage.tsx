import { useEffect, useMemo, useRef, useState } from 'react';
import { CardDetailDialog, type CardDetailCard, type CardDetailMutationState } from '../cardDetail';
import {
  CollectionCardMutationError,
  decreaseCollectionCardQuantity,
  getCollectionCardOwnershipForCatalogCards,
  increaseCollectionCardQuantity,
  type CollectionOwnershipState,
} from '../collectionCards';
import { checkCollectionReadiness } from '../collections';
import {
  createCollectionCardDetailProductCopy,
  createCollectionCardDetailCapabilities,
  getCollectionCardDetailQuantityFromMutation,
  getConfirmedOwnership,
  mapCollectionCardDetailDecreaseResult,
  mapCollectionCardDetailIncreaseResult,
  shouldApplyCollectionCardDetailResponse,
  toCollectionCardDetailCard,
  type CollectionCardDetailRequest,
} from './collectionCardDetailAdapter';
import { getCollectionFilterOptions, loadCollectionPage } from './collectionPageService';
import {
  COLLECTION_PAGE_SIZE,
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
  collectionId: null,
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
  const [selectedDetailCard, setSelectedDetailCard] = useState<CardDetailCard | null>(null);
  const [detailOwnership, setDetailOwnership] = useState<CollectionOwnershipState>({ status: 'idle' });
  const [detailMutation, setDetailMutation] = useState<CardDetailMutationState>({ status: 'idle' });
  const detailRequestIdRef = useRef(0);
  const activeDetailRequestRef = useRef<CollectionCardDetailRequest | null>(null);
  const mutationRequestIdRef = useRef(0);
  const collectionContextRef = useRef({
    collectionId: null as string | null,
    page: 1,
    searchTerm: '',
    filters,
  });
  const cardButtonRefs = useRef(new Map<string, HTMLButtonElement>());
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

  collectionContextRef.current = {
    collectionId: collectionPageState.collectionId,
    page,
    searchTerm: activeSearchTerm,
    filters,
  };

  useEffect(() => {
    activeDetailRequestRef.current = null;
    detailRequestIdRef.current += 1;
    setSelectedDetailCard(null);
    setDetailOwnership({ status: 'idle' });
    setDetailMutation({ status: 'idle' });
  }, [activeSearchTerm, collectionPageState.collectionId, filters, page]);

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
  }, [filters]);

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

  const loadSelectedCardOwnership = (card: CardDetailCard, collectionId: string) => {
    const request: CollectionCardDetailRequest = {
      requestId: detailRequestIdRef.current + 1,
      collectionId,
      cardCatalogId: card.cardCatalogId,
      page: collectionPageState.page,
    };
    detailRequestIdRef.current = request.requestId;
    activeDetailRequestRef.current = request;
    setDetailOwnership((previous) => ({
      status: 'loading',
      previous: getConfirmedOwnership(previous),
    }));

    getCollectionCardOwnershipForCatalogCards({ collectionId, cardCatalogIds: [card.cardCatalogId] })
      .then((ownershipByCardCatalogId) => {
        if (!shouldApplyCollectionCardDetailResponse(activeDetailRequestRef.current, request)) {
          return;
        }

        const ownership = ownershipByCardCatalogId.get(card.cardCatalogId);
        setDetailOwnership(
          ownership
            ? { status: 'ready', value: ownership }
            : { status: 'error', previous: undefined, retryable: true },
        );
        setDetailMutation((currentMutation) => currentMutation.status === 'conflict'
          ? { ...currentMutation, refreshStatus: 'ready' }
          : currentMutation);
      })
      .catch(() => {
        if (shouldApplyCollectionCardDetailResponse(activeDetailRequestRef.current, request)) {
          setDetailOwnership({ status: 'error', retryable: true });
          setDetailMutation((currentMutation) => currentMutation.status === 'conflict'
            ? { ...currentMutation, refreshStatus: 'error' }
            : currentMutation);
        }
      });
  };

  const refreshBoundedCollectionPage = (request: CollectionCardDetailRequest, mutationRequestId: number) => {
    loadCollectionPage(request.page, { searchQuery: activeSearchTerm, filters }).then((nextState) => {
      const currentContext = collectionContextRef.current;
      if (
        mutationRequestIdRef.current === mutationRequestId &&
        currentContext.page === request.page &&
        currentContext.searchTerm === activeSearchTerm &&
        currentContext.collectionId === request.collectionId &&
        currentContext.filters.rarity === filters.rarity &&
        currentContext.filters.setCode === filters.setCode
      ) {
        setCollectionPageState(nextState);
        setPage(nextState.page);
      }
    });
  };

  const handleCollectionCardQuantityChange = async (operation: 'increase' | 'decrease') => {
    const card = selectedDetailCard;
    const collectionId = collectionPageState.collectionId;
    const confirmedOwnership = getConfirmedOwnership(detailOwnership);
    const manageable = confirmedOwnership?.kind === 'snapshot'
      ? confirmedOwnership.value.manageableOwnedNearMintRecord
      : undefined;
    const capabilities = createCollectionCardDetailCapabilities(detailOwnership);

    if (!card || !collectionId || !manageable || !(operation === 'increase' ? capabilities.canIncrease : capabilities.canDecrease)) {
      return;
    }

    const request = activeDetailRequestRef.current;
    if (!request) return;

    const mutationRequestId = mutationRequestIdRef.current + 1;
    mutationRequestIdRef.current = mutationRequestId;
    setDetailMutation({ status: 'pending', operation });

    try {
      const result = operation === 'increase'
        ? mapCollectionCardDetailIncreaseResult(await increaseCollectionCardQuantity({ collectionId, collectionCardId: manageable.collectionCardId, currentQuantity: manageable.quantity }))
        : mapCollectionCardDetailDecreaseResult(await decreaseCollectionCardQuantity({ collectionId, collectionCardId: manageable.collectionCardId, currentQuantity: manageable.quantity }));

      if (mutationRequestIdRef.current !== mutationRequestId || !shouldApplyCollectionCardDetailResponse(activeDetailRequestRef.current, request)) return;

      if (result.kind === 'deleted') {
        closeCollectionCardDetail();
        refreshBoundedCollectionPage(request, mutationRequestId);
        return;
      }

      const nextQuantity = getCollectionCardDetailQuantityFromMutation(result);
      setCollectionPageState((currentState) => ({
        ...currentState,
        cards: currentState.cards.map((pageCard) => pageCard.cardCatalogId === card.cardCatalogId ? { ...pageCard, quantity: nextQuantity } : pageCard),
      }));
      setDetailMutation({ status: 'idle' });
      loadSelectedCardOwnership(card, collectionId);
    } catch (error: unknown) {
      if (mutationRequestIdRef.current !== mutationRequestId || !shouldApplyCollectionCardDetailResponse(activeDetailRequestRef.current, request)) return;

      if (error instanceof CollectionCardMutationError && (error.reason === 'stale' || error.reason === 'invalid-result')) {
        setDetailMutation({ status: 'conflict', operation, refreshStatus: 'pending', message: 'De status is gewijzigd. Collectiestatus wordt vernieuwd.' });
        loadSelectedCardOwnership(card, collectionId);
        return;
      }

      setDetailMutation({ status: 'error', operation, retryable: true, message: 'Bijwerken is mislukt. Probeer opnieuw.' });
    }
  };

  const openCollectionCardDetail = (card: CollectionPageState['cards'][number]) => {
    const detailCard = toCollectionCardDetailCard(card);
    const collectionId = collectionPageState.collectionId;

    if (!detailCard || !collectionId) {
      return;
    }

    setSelectedDetailCard(detailCard);
    loadSelectedCardOwnership(detailCard, collectionId);
  };

  const closeCollectionCardDetail = () => {
    const closingCardCatalogId = selectedDetailCard?.cardCatalogId;
    activeDetailRequestRef.current = null;
    detailRequestIdRef.current += 1;
    setSelectedDetailCard(null);
    setDetailOwnership({ status: 'idle' });
    setDetailMutation({ status: 'idle' });

    window.setTimeout(() => {
      if (closingCardCatalogId) {
        cardButtonRefs.current.get(closingCardCatalogId)?.focus();
      }
    }, 0);
  };

  return (
    <>
    <section
      className="collection-page"
      aria-labelledby="collection-page-title"
      inert={selectedDetailCard ? true : undefined}
      aria-hidden={selectedDetailCard ? true : undefined}
    >
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
            {collectionPageState.cards.map((card) => {
              const titleId = `collection-card-${card.cardCatalogId}-title`;
              const subtitleId = `collection-card-${card.cardCatalogId}-subtitle`;
              const metadataId = `collection-card-${card.cardCatalogId}-metadata`;

              return (
                <li key={card.cardCatalogId}>
                  {card.imageSmall ? (
                    <img src={card.imageSmall} alt={card.pokemon ? `${card.pokemon} kaart` : 'Collectiekaart'} loading="lazy" />
                  ) : (
                    <div className="card-image-placeholder" aria-label="Geen afbeelding beschikbaar">
                      Geen afbeelding
                    </div>
                  )}
                  <div className="collection-page-card-body">
                    <h3 id={titleId}>{formatValue(card.pokemon)}</h3>
                    <p id={subtitleId}>{formatValue(card.setName)} · #{formatValue(card.number)}</p>
                    <dl id={metadataId} className="collection-page-card-meta">
                      <div><dt>Rarity</dt><dd>{formatValue(card.rarity)}</dd></div>
                      <div><dt>Aantal</dt><dd>{formatValue(card.quantity)}</dd></div>
                      <div><dt>Conditie</dt><dd>{formatValue(card.condition)}</dd></div>
                      <div><dt>Status</dt><dd>{formatValue(card.status)}</dd></div>
                    </dl>
                  </div>
                  <button
                    ref={(element) => {
                      if (element) cardButtonRefs.current.set(card.cardCatalogId, element);
                      else cardButtonRefs.current.delete(card.cardCatalogId);
                    }}
                    className="collection-page-card-button"
                    type="button"
                    aria-labelledby={`${titleId} ${subtitleId}`}
                    aria-describedby={metadataId}
                    onClick={() => openCollectionCardDetail(card)}
                  />
                </li>
              );
            })}
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
    {selectedDetailCard ? (
      <CardDetailDialog
        card={selectedDetailCard}
        ownership={detailOwnership}
        mutation={detailMutation}
        capabilities={createCollectionCardDetailCapabilities(detailOwnership)}
        copy={createCollectionCardDetailProductCopy(detailOwnership)}
        onClose={closeCollectionCardDetail}
        onRetryOwnership={() => {
          if (collectionPageState.collectionId) {
            loadSelectedCardOwnership(selectedDetailCard, collectionPageState.collectionId);
          }
        }}
        onIncrease={() => void handleCollectionCardQuantityChange('increase')}
        onDecrease={() => void handleCollectionCardQuantityChange('decrease')}
      />
    ) : null}
    </>
  );
}
