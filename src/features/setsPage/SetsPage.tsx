import { useEffect, useMemo, useRef, useState } from 'react';

import { checkCollectionReadiness } from '../collections';
import { getSetsCatalog, type SetsCatalogRow } from '../../services/setsCatalogService';
import {
  getSetCards,
  SET_CARDS_BATCH_SIZE,
  type SetCatalogCard,
  type SetCardsSortOption,
} from './services/setCardsService';
import { getCollectionCardIdsForCatalogCards } from './services/setCardCollectionStateService';
import { getSetProgressForCollection, type SetProgress } from './services/setsProgressService';
import { calculateSetProgressPercent, getEffectiveSetTotal, hasKnownSetTotal } from './services/setTotals';

type SetsPageState =
  | { status: 'loading'; sets: SetsCatalogRow[]; errorMessage?: undefined }
  | { status: 'success'; sets: SetsCatalogRow[]; errorMessage?: undefined }
  | { status: 'error'; sets: SetsCatalogRow[]; errorMessage: string };

type SetsProgressState = {
  status: 'idle' | 'loading' | 'success' | 'unavailable';
  progressBySetCode: Map<string, SetProgress>;
};

type GroupedSets = {
  series: string;
  sets: SetsCatalogRow[];
};

type SetCardsStatus = 'closed' | 'loading' | 'success' | 'loadingMore' | 'error';

type SetCardsOverlayState = {
  status: SetCardsStatus;
  cards: SetCatalogCard[];
  totalCount: number;
  offset: number;
  hasMore: boolean;
  errorMessage?: string;
};

type SetCardCollectionState = {
  status: 'idle' | 'loading' | 'success' | 'error';
  collectionCardCatalogIds: Set<string>;
};

const FALLBACK_SERIES_LABEL = 'Overige sets';

const INITIAL_SET_CARDS_OVERLAY_STATE: SetCardsOverlayState = {
  status: 'closed',
  cards: [],
  totalCount: 0,
  offset: 0,
  hasMore: false,
};

const INITIAL_SET_CARD_COLLECTION_STATE: SetCardCollectionState = {
  status: 'idle',
  collectionCardCatalogIds: new Set(),
};

const SET_CARDS_SORT_LABELS: Record<SetCardsSortOption, string> = {
  'name-asc': 'Naam A–Z',
  'name-desc': 'Naam Z–A',
};

function formatSetProgressText(ownedCount: number, total: number | null) {
  if (hasKnownSetTotal(total)) {
    return `${ownedCount} van ${total}`;
  }

  if (ownedCount > 0) {
    return `${ownedCount} kaarten verzameld`;
  }

  return 'Nog geen totaal bekend';
}

export function SetsPage() {
  const [setsPageState, setSetsPageState] = useState<SetsPageState>({ status: 'loading', sets: [] });
  const [setsProgressState, setSetsProgressState] = useState<SetsProgressState>({
    status: 'idle',
    progressBySetCode: new Map(),
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [openSetId, setOpenSetId] = useState<string | null>(null);
  const [setCardSearchTerm, setSetCardSearchTerm] = useState('');
  const [debouncedSetCardSearchTerm, setDebouncedSetCardSearchTerm] = useState('');
  const [setCardsSortOption, setSetCardsSortOption] = useState<SetCardsSortOption>('name-asc');
  const [setCardsRetryNonce, setSetCardsRetryNonce] = useState(0);
  const [setCardsOverlayState, setSetCardsOverlayState] =
    useState<SetCardsOverlayState>(INITIAL_SET_CARDS_OVERLAY_STATE);
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null);
  const [setCardCollectionState, setSetCardCollectionState] = useState<SetCardCollectionState>(
    INITIAL_SET_CARD_COLLECTION_STATE,
  );
  const setCardsRequestIdRef = useRef(0);
  const setCardCollectionRequestIdRef = useRef(0);
  const setButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const overlayCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const overlayScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadSetsCatalog() {
      setSetsPageState({ status: 'loading', sets: [] });

      try {
        const sets = await getSetsCatalog();

        if (isMounted) {
          setSetsPageState({ status: 'success', sets });
        }
      } catch (error) {
        if (isMounted) {
          setSetsPageState({
            status: 'error',
            sets: [],
            errorMessage: error instanceof Error ? error.message : 'Sets catalog ophalen is mislukt.',
          });
        }
      }
    }

    void loadSetsCatalog();

    return () => {
      isMounted = false;
    };
  }, []);

  const openSet = useMemo(() => {
    if (!openSetId) {
      return null;
    }

    return setsPageState.sets.find((set) => set.id === openSetId) ?? null;
  }, [openSetId, setsPageState.sets]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSetCardSearchTerm(setCardSearchTerm.trim());
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [setCardSearchTerm]);

  useEffect(() => {
    if (!openSet) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    overlayScrollRef.current?.scrollTo({ top: 0 });
    window.setTimeout(() => overlayCloseButtonRef.current?.focus(), 0);

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [openSet]);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape' && openSet) {
        closeSetOverlay();
      }
    }

    window.addEventListener('keydown', handleEscape);

    return () => window.removeEventListener('keydown', handleEscape);
  });

  useEffect(() => {
    if (!openSet) {
      setCardsRequestIdRef.current += 1;
      setSetCardsOverlayState(INITIAL_SET_CARDS_OVERLAY_STATE);
      return;
    }

    let isCancelled = false;
    const requestId = setCardsRequestIdRef.current + 1;
    setCardsRequestIdRef.current = requestId;
    const setCode = openSet.set_code;
    const searchTermForRequest = debouncedSetCardSearchTerm;
    const sortOptionForRequest = setCardsSortOption;

    async function loadInitialSetCards() {
      overlayScrollRef.current?.scrollTo({ top: 0 });
      setSetCardsOverlayState({
        status: 'loading',
        cards: [],
        totalCount: 0,
        offset: 0,
        hasMore: false,
      });

      try {
        const result = await getSetCards({
          setCode,
          offset: 0,
          limit: SET_CARDS_BATCH_SIZE,
          searchTerm: searchTermForRequest,
          sortOption: sortOptionForRequest,
        });

        if (!isCancelled && setCardsRequestIdRef.current === requestId) {
          setSetCardsOverlayState({
            status: 'success',
            cards: result.cards,
            totalCount: result.totalCount,
            offset: result.cards.length,
            hasMore: result.hasMore,
          });
        }
      } catch {
        if (!isCancelled && setCardsRequestIdRef.current === requestId) {
          setSetCardsOverlayState({
            status: 'error',
            cards: [],
            totalCount: 0,
            offset: 0,
            hasMore: false,
            errorMessage: 'Kaarten laden is mislukt.',
          });
        }
      }
    }

    void loadInitialSetCards();

    return () => {
      isCancelled = true;
    };
  }, [debouncedSetCardSearchTerm, openSet, setCardsRetryNonce, setCardsSortOption]);

  const loadedSetCardIds = useMemo(() => setCardsOverlayState.cards.map((card) => card.id), [setCardsOverlayState.cards]);
  const loadedSetCardIdsKey = loadedSetCardIds.join(',');

  useEffect(() => {
    const requestId = setCardCollectionRequestIdRef.current + 1;
    setCardCollectionRequestIdRef.current = requestId;

    if (!openSet || !activeCollectionId || loadedSetCardIds.length === 0) {
      setSetCardCollectionState(INITIAL_SET_CARD_COLLECTION_STATE);
      return;
    }

    let isCancelled = false;
    const collectionIdForRequest = activeCollectionId;
    const cardCatalogIdsForRequest = loadedSetCardIds;

    async function loadSetCardCollectionState() {
      setSetCardCollectionState({ status: 'loading', collectionCardCatalogIds: new Set() });

      try {
        const collectionCardCatalogIds = await getCollectionCardIdsForCatalogCards({
          collectionId: collectionIdForRequest,
          cardCatalogIds: cardCatalogIdsForRequest,
        });

        if (!isCancelled && setCardCollectionRequestIdRef.current === requestId) {
          setSetCardCollectionState({ status: 'success', collectionCardCatalogIds });
        }
      } catch {
        if (!isCancelled && setCardCollectionRequestIdRef.current === requestId) {
          setSetCardCollectionState({ status: 'error', collectionCardCatalogIds: new Set() });
        }
      }
    }

    void loadSetCardCollectionState();

    return () => {
      isCancelled = true;
    };
  }, [activeCollectionId, loadedSetCardIdsKey, openSet]);

  async function loadMoreSetCards() {
    if (!openSet || setCardsOverlayState.status === 'loading' || setCardsOverlayState.status === 'loadingMore') {
      return;
    }

    const requestId = setCardsRequestIdRef.current + 1;
    setCardsRequestIdRef.current = requestId;
    const setCode = openSet.set_code;
    const currentOffset = setCardsOverlayState.offset;
    const existingCards = setCardsOverlayState.cards;

    setSetCardsOverlayState((currentState) => ({
      ...currentState,
      status: 'loadingMore',
      errorMessage: undefined,
    }));

    try {
      const result = await getSetCards({
        setCode,
        offset: currentOffset,
        limit: SET_CARDS_BATCH_SIZE,
        searchTerm: debouncedSetCardSearchTerm,
        sortOption: setCardsSortOption,
      });

      if (setCardsRequestIdRef.current === requestId) {
        const seenCardIds = new Set(existingCards.map((card) => card.id));
        const newCards = result.cards.filter((card) => !seenCardIds.has(card.id));
        const cards = [...existingCards, ...newCards];

        setSetCardsOverlayState({
          status: 'success',
          cards,
          totalCount: result.totalCount,
          offset: currentOffset + result.cards.length,
          hasMore: cards.length < result.totalCount,
        });
      }
    } catch {
      if (setCardsRequestIdRef.current === requestId) {
        setSetCardsOverlayState((currentState) => ({
          ...currentState,
          status: 'error',
          errorMessage: 'Meer kaarten laden is mislukt.',
        }));
      }
    }
  }

  function openSetOverlay(setId: string) {
    setSetCardSearchTerm('');
    setDebouncedSetCardSearchTerm('');
    setSetCardsSortOption('name-asc');
    setSetCardsRetryNonce(0);
    setCardsRequestIdRef.current += 1;
    setCardCollectionRequestIdRef.current += 1;
    setSetCardsOverlayState(INITIAL_SET_CARDS_OVERLAY_STATE);
    setSetCardCollectionState(INITIAL_SET_CARD_COLLECTION_STATE);
    setOpenSetId(setId);
  }

  function closeSetOverlay() {
    const closingSetId = openSetId;
    setOpenSetId(null);
    setSetCardSearchTerm('');
    setDebouncedSetCardSearchTerm('');
    setSetCardsSortOption('name-asc');
    setSetCardsRetryNonce(0);
    setCardsRequestIdRef.current += 1;
    setCardCollectionRequestIdRef.current += 1;
    setSetCardsOverlayState(INITIAL_SET_CARDS_OVERLAY_STATE);
    setSetCardCollectionState(INITIAL_SET_CARD_COLLECTION_STATE);
    window.setTimeout(() => {
      if (closingSetId) {
        setButtonRefs.current.get(closingSetId)?.focus();
      }
    }, 0);
  }

  useEffect(() => {
    let isMounted = true;

    async function loadSetsProgress() {
      setSetsProgressState({ status: 'loading', progressBySetCode: new Map() });
      setActiveCollectionId(null);

      try {
        const collectionReadiness = await checkCollectionReadiness();
        const collectionId = collectionReadiness.mainCollection?.id;

        if (collectionReadiness.status !== 'collection-ready' || !collectionId) {
          if (isMounted) {
            setSetsProgressState({ status: 'unavailable', progressBySetCode: new Map() });
          }

          return;
        }

        if (isMounted) {
          setActiveCollectionId(collectionId);
        }

        const setProgress = await getSetProgressForCollection(collectionId);
        const progressBySetCode = new Map(setProgress.map((progress) => [progress.setCode, progress]));

        if (isMounted) {
          setSetsProgressState({ status: 'success', progressBySetCode });
        }
      } catch {
        if (isMounted) {
          setSetsProgressState({ status: 'unavailable', progressBySetCode: new Map() });
        }
      }
    }

    void loadSetsProgress();

    return () => {
      isMounted = false;
    };
  }, []);

  const catalogSummary = useMemo(
    () => ({
      loadedSetsCount: setsPageState.sets.length,
      setsWithMetadataCount: setsPageState.sets.filter((set) => set.release_date || hasKnownSetTotal(getEffectiveSetTotal(set))).length,
    }),
    [setsPageState.sets],
  );

  const normalizedSearchTerm = searchTerm.trim().toLowerCase();
  const filteredSets = useMemo(() => {
    if (!normalizedSearchTerm) {
      return setsPageState.sets;
    }

    return setsPageState.sets.filter((set) => {
      const setName = set.name.toLowerCase();
      const seriesName = set.series?.toLowerCase() ?? '';

      return setName.includes(normalizedSearchTerm) || seriesName.includes(normalizedSearchTerm);
    });
  }, [normalizedSearchTerm, setsPageState.sets]);

  const groupedSets = useMemo(() => {
    return filteredSets.reduce<GroupedSets[]>((groups, set) => {
      const series = set.series ?? FALLBACK_SERIES_LABEL;
      const existingGroup = groups.find((group) => group.series === series);

      if (existingGroup) {
        existingGroup.sets.push(set);
      } else {
        groups.push({ series, sets: [set] });
      }

      return groups;
    }, []);
  }, [filteredSets]);

  const isLoading = setsPageState.status === 'loading';
  const isError = setsPageState.status === 'error';
  const isEmpty = setsPageState.status === 'success' && setsPageState.sets.length === 0;
  const hasNoSearchResults = setsPageState.status === 'success' && setsPageState.sets.length > 0 && filteredSets.length === 0;

  return (
    <section className="sets-page" aria-labelledby="sets-page-title">
      <div className="sets-page-hero">
        <p className="eyebrow">Set-catalogus</p>
        <h2 id="sets-page-title">Sets</h2>
        <p>Volledige set-catalogus met collectievoortgang wanneer die beschikbaar is.</p>
      </div>

      <dl className="sets-page-summary" aria-label="Samenvatting van de set-catalogus">
        <div>
          <dt>Sets geladen</dt>
          <dd>{catalogSummary.loadedSetsCount}</dd>
        </div>
        <div>
          <dt>Sets met metadata</dt>
          <dd>{catalogSummary.setsWithMetadataCount}</dd>
        </div>
      </dl>

      {setsProgressState.status === 'loading' ? (
        <p className="sets-page-progress-note" role="status">
          Collectievoortgang wordt geladen...
        </p>
      ) : null}

      <section className="sets-page-card" aria-labelledby="sets-page-catalog-title">
        <h3 id="sets-page-catalog-title">Set-catalog</h3>

        <div className="sets-page-search">
          <label htmlFor="sets-page-search-input">Zoeken</label>
          <div className="sets-page-search-control">
            <input
              id="sets-page-search-input"
              type="search"
              placeholder="Zoek set..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
            {searchTerm ? (
              <button type="button" aria-label="Zoekterm wissen" onClick={() => setSearchTerm('')}>
                ×
              </button>
            ) : null}
          </div>
        </div>

        {isLoading ? <p role="status">Sets worden geladen...</p> : null}

        {isError ? (
          <p role="alert">Fout bij het laden van de sets: {setsPageState.errorMessage}</p>
        ) : null}

        {isEmpty ? <p>Er zijn nog geen sets beschikbaar in de catalog.</p> : null}

        {hasNoSearchResults ? <p>Geen sets gevonden.</p> : null}

        {groupedSets.length > 0 ? (
          <div className="sets-page-series-list" aria-label="Beschikbare sets per series">
            {groupedSets.map((group, index) => {
              const seriesHeadingId = `sets-page-series-${index}`;

              return (
                <section key={group.series} className="sets-page-series-group" aria-labelledby={seriesHeadingId}>
                  <h4 id={seriesHeadingId} className="sets-page-series-heading">
                    {group.series}
                  </h4>

                  <ul className="sets-page-catalog-grid" aria-label={`${group.series} sets`}>
                    {group.sets.map((set) => {
                      const setProgress = setsProgressState.progressBySetCode.get(set.set_code);
                      const ownedCount = setProgress?.ownedCount ?? 0;
                      const effectiveSetTotal = getEffectiveSetTotal(set);
                      const progressPercent = calculateSetProgressPercent(ownedCount, effectiveSetTotal);
                      const setImageUrl = set.logo_url ?? set.symbol_url;
                      const setImageAlt = set.logo_url ? `${set.name} logo` : `${set.name} symbool`;
                      const isOpen = openSetId === set.id;

                      return (
                        <li key={set.id} className={`sets-page-set-card${isOpen ? ' is-open' : ''}`}>
                          <button
                            ref={(buttonElement) => {
                              if (buttonElement) {
                                setButtonRefs.current.set(set.id, buttonElement);
                              }
                            }}
                            type="button"
                            className="sets-page-set-summary-button"
                            aria-expanded={isOpen}
                            aria-controls={isOpen ? 'sets-page-set-overlay' : undefined}
                            onClick={() => openSetOverlay(set.id)}
                          >
                            <span className="sets-page-set-media" aria-hidden={setImageUrl ? undefined : true}>
                              {setImageUrl ? (
                                <img src={setImageUrl} alt={setImageAlt} width="96" height="40" loading="lazy" />
                              ) : (
                                <span className="sets-page-set-media-placeholder">Geen logo</span>
                              )}
                            </span>

                            <span className="sets-page-set-content">
                              <span className="sets-page-set-heading">
                                <strong className="sets-page-set-name">{set.name}</strong>
                              </span>

                              <span className="sets-page-set-progress" aria-label={`Collectievoortgang voor ${set.name}`}>
                                <span>{formatSetProgressText(ownedCount, effectiveSetTotal)}</span>
                                {progressPercent !== null ? (
                                  <span
                                    className="sets-page-set-progress-bar"
                                    role="progressbar"
                                    aria-valuemin={0}
                                    aria-valuemax={100}
                                    aria-valuenow={progressPercent}
                                    aria-label={`${progressPercent}% compleet`}
                                  >
                                    <span style={{ width: `${progressPercent}%` }} />
                                  </span>
                                ) : null}
                              </span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </div>
        ) : null}
      </section>

      {openSet ? (() => {
        const setProgress = setsProgressState.progressBySetCode.get(openSet.set_code);
        const ownedCount = setProgress?.ownedCount ?? 0;
        const effectiveSetTotal = getEffectiveSetTotal(openSet);
        const progressPercent = calculateSetProgressPercent(ownedCount, effectiveSetTotal);
        const isInitialLoading = setCardsOverlayState.status === 'loading';
        const isLoadingMore = setCardsOverlayState.status === 'loadingMore';
        const hasCards = setCardsOverlayState.cards.length > 0;
        const isSearchActive = debouncedSetCardSearchTerm.length > 0;
        const showInitialError = setCardsOverlayState.status === 'error' && !hasCards;
        const showLoadMoreError = setCardsOverlayState.status === 'error' && hasCards;
        const showEmptyState =
          setCardsOverlayState.status === 'success' && setCardsOverlayState.totalCount === 0 && !isSearchActive;
        const showSearchEmptyState =
          setCardsOverlayState.status === 'success' && setCardsOverlayState.totalCount === 0 && isSearchActive;
        const showCollectionStateError = setCardCollectionState.status === 'error';

        return (
          <div
            id="sets-page-set-overlay"
            className="sets-page-set-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sets-page-set-overlay-title"
          >
            <header className="sets-page-set-overlay-header">
              <button
                ref={overlayCloseButtonRef}
                type="button"
                className="sets-page-set-overlay-back"
                aria-label="Terug naar sets"
                onClick={closeSetOverlay}
              >
                ←
              </button>
              <div>
                <p className="sets-page-set-overlay-kicker">Set</p>
                <h3 id="sets-page-set-overlay-title">{openSet.name}</h3>
              </div>
            </header>

            <div ref={overlayScrollRef} className="sets-page-set-overlay-scroll">
              <section className="sets-page-set-overlay-summary" aria-label="Setinformatie">
                <div>
                  <span>Setnaam</span>
                  <strong>{openSet.name}</strong>
                </div>
                {openSet.series ? (
                  <div>
                    <span>Series</span>
                    <strong>{openSet.series}</strong>
                  </div>
                ) : null}
                <div>
                  <span>Releasedatum</span>
                  <strong>{openSet.release_date ?? 'Onbekend'}</strong>
                </div>
                <div>
                  <span>Verzameld</span>
                  <strong>{formatSetProgressText(ownedCount, effectiveSetTotal)}</strong>
                </div>
                <div>
                  <span>Officieel settotaal</span>
                  <strong>{hasKnownSetTotal(effectiveSetTotal) ? effectiveSetTotal : 'Niet bekend'}</strong>
                </div>
                <div>
                  <span>Cataloguskaarten beschikbaar</span>
                  <strong>{setCardsOverlayState.totalCount}</strong>
                </div>
                {progressPercent !== null ? (
                  <div className="sets-page-set-overlay-progress">
                    <span>Voortgang</span>
                    <strong>{progressPercent}%</strong>
                    <span
                      className="sets-page-set-progress-bar"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={progressPercent}
                      aria-label={`${progressPercent}% compleet`}
                    >
                      <span style={{ width: `${progressPercent}%` }} />
                    </span>
                  </div>
                ) : null}
              </section>

              <section className="sets-page-set-overlay-controls" aria-label="Kaarten zoeken en sorteren">
                <label htmlFor="sets-page-set-card-search">Zoek kaarten</label>
                <div className="sets-page-set-card-search-control">
                  <input
                    id="sets-page-set-card-search"
                    type="search"
                    placeholder="Zoek naam of nummer..."
                    value={setCardSearchTerm}
                    onChange={(event) => setSetCardSearchTerm(event.target.value)}
                  />
                  {setCardSearchTerm ? (
                    <button type="button" aria-label="Kaartzoekterm wissen" onClick={() => setSetCardSearchTerm('')}>
                      ×
                    </button>
                  ) : null}
                </div>

                <label htmlFor="sets-page-set-card-sort">Sorteren</label>
                <select
                  id="sets-page-set-card-sort"
                  value={setCardsSortOption}
                  onChange={(event) => setSetCardsSortOption(event.target.value as SetCardsSortOption)}
                >
                  {Object.entries(SET_CARDS_SORT_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </section>

              {isInitialLoading ? (
                <div className="sets-page-set-card-skeleton-grid" role="status" aria-live="polite" aria-label="Kaarten laden">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <span key={index} className="sets-page-set-card-skeleton" />
                  ))}
                </div>
              ) : null}

              {showInitialError ? (
                <div className="sets-page-set-overlay-message" role="alert">
                  <p>{setCardsOverlayState.errorMessage}</p>
                  <button type="button" onClick={() => setSetCardsRetryNonce((retryNonce) => retryNonce + 1)}>
                    Opnieuw proberen
                  </button>
                </div>
              ) : null}

              {showEmptyState ? (
                <p className="sets-page-set-overlay-empty">Voor deze set zijn nog geen cataloguskaarten beschikbaar.</p>
              ) : null}

              {showSearchEmptyState ? (
                <p className="sets-page-set-overlay-empty">Geen kaarten gevonden voor deze zoekopdracht.</p>
              ) : null}

              {showCollectionStateError ? (
                <p className="sets-page-set-card-collection-status-message" role="alert">
                  Collectiestatus kon niet worden geladen.
                </p>
              ) : null}

              {hasCards ? (
                <>
                  <p className="sets-page-set-overlay-count">
                    {setCardsOverlayState.cards.length} van {setCardsOverlayState.totalCount} cataloguskaarten getoond
                  </p>
                  <ul className="sets-page-set-overlay-grid" aria-label={`Cataloguskaarten voor ${openSet.name}`}>
                    {setCardsOverlayState.cards.map((card) => {
                      const isCollectionStateLoaded = setCardCollectionState.status === 'success';
                      const isInCollection = setCardCollectionState.collectionCardCatalogIds.has(card.id);
                      const collectionStateLabel = isCollectionStateLoaded
                        ? isInCollection
                          ? 'In collectie'
                          : 'Niet in collectie'
                        : setCardCollectionState.status === 'loading'
                          ? 'Status laden…'
                          : 'Status onbekend';
                      const collectionStateClassName = isCollectionStateLoaded
                        ? isInCollection
                          ? ' is-present'
                          : ' is-absent'
                        : ' is-unknown';

                      return (
                        <li key={card.id} className="sets-page-set-overlay-card">
                          {card.image_small ? (
                            <img
                              src={card.image_small}
                              alt={`${card.pokemon} kaart ${card.number ?? ''}`.trim()}
                              width="120"
                              height="168"
                              loading="lazy"
                              decoding="async"
                            />
                          ) : (
                            <span className="sets-page-set-overlay-card-placeholder" aria-hidden="true">
                              Geen afbeelding
                            </span>
                          )}
                          <span className="sets-page-set-overlay-card-body">
                            <strong>{card.pokemon}</strong>
                            <span>Nr. {card.number ?? 'onbekend'}</span>
                            {card.rarity ? <span>{card.rarity}</span> : null}
                            <span className={`sets-page-set-card-collection-badge${collectionStateClassName}`}>
                              {collectionStateLabel}
                            </span>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </>
              ) : null}

              {showLoadMoreError ? (
                <div className="sets-page-set-overlay-message" role="alert">
                  <p>{setCardsOverlayState.errorMessage}</p>
                </div>
              ) : null}

              {setCardsOverlayState.hasMore && hasCards ? (
                <div className="sets-page-set-overlay-load-more">
                  <button type="button" disabled={isLoadingMore} onClick={() => void loadMoreSetCards()}>
                    {isLoadingMore ? 'Meer kaarten laden…' : 'Meer kaarten laden'}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        );
      })() : null}
    </section>
  );
}
