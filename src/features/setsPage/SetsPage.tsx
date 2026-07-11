import { useEffect, useMemo, useRef, useState } from 'react';

import { checkCollectionReadiness } from '../collections';
import { getSetsCatalog, type SetsCatalogRow } from '../../services/setsCatalogService';
import {
  getSetCards,
  SET_CARDS_PAGE_SIZE,
  type SetCatalogCard,
} from './services/setCardsService';
import { getSetProgressForCollection, type SetProgress } from './services/setsProgressService';

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

type SetCardsState =
  | {
      status: 'idle' | 'loading';
      cards: SetCatalogCard[];
      totalCount: number;
      page: number;
      pageSize: number;
      totalPages: number;
      errorMessage?: undefined;
    }
  | {
      status: 'success';
      cards: SetCatalogCard[];
      totalCount: number;
      page: number;
      pageSize: number;
      totalPages: number;
      errorMessage?: undefined;
    }
  | {
      status: 'error';
      cards: SetCatalogCard[];
      totalCount: number;
      page: number;
      pageSize: number;
      totalPages: number;
      errorMessage: string;
    };

const FALLBACK_SERIES_LABEL = 'Overige sets';

const INITIAL_SET_CARDS_STATE: SetCardsState = {
  status: 'idle',
  cards: [],
  totalCount: 0,
  page: 1,
  pageSize: SET_CARDS_PAGE_SIZE,
  totalPages: 0,
};

function hasKnownSetTotal(total: number | null): total is number {
  return total !== null && total > 0;
}

function formatSetProgressText(ownedCount: number, total: number | null) {
  if (hasKnownSetTotal(total)) {
    return `${ownedCount} van ${total}`;
  }

  if (ownedCount > 0) {
    return `${ownedCount} kaarten verzameld`;
  }

  return 'Nog geen totaal bekend';
}

function calculateProgressPercent(ownedCount: number, total: number) {
  return Math.min(100, Math.round((ownedCount / total) * 100));
}

export function SetsPage() {
  const [setsPageState, setSetsPageState] = useState<SetsPageState>({ status: 'loading', sets: [] });
  const [setsProgressState, setSetsProgressState] = useState<SetsProgressState>({
    status: 'idle',
    progressBySetCode: new Map(),
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [openSetId, setOpenSetId] = useState<string | null>(null);
  const [setCardsState, setSetCardsState] = useState<SetCardsState>(INITIAL_SET_CARDS_STATE);
  const setCardsRequestIdRef = useRef(0);

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
    if (!openSet) {
      setCardsRequestIdRef.current += 1;
      setSetCardsState(INITIAL_SET_CARDS_STATE);
      return;
    }

    let isCancelled = false;
    const requestId = setCardsRequestIdRef.current + 1;
    setCardsRequestIdRef.current = requestId;
    const setCode = openSet.set_code;

    async function loadSetCards() {
      setSetCardsState({
        status: 'loading',
        cards: [],
        totalCount: 0,
        page: 1,
        pageSize: SET_CARDS_PAGE_SIZE,
        totalPages: 0,
      });

      try {
        const result = await getSetCards(setCode, 1);

        if (!isCancelled && setCardsRequestIdRef.current === requestId) {
          setSetCardsState({ status: 'success', ...result });
        }
      } catch {
        if (!isCancelled && setCardsRequestIdRef.current === requestId) {
          setSetCardsState({
            status: 'error',
            cards: [],
            totalCount: 0,
            page: 1,
            pageSize: SET_CARDS_PAGE_SIZE,
            totalPages: 0,
            errorMessage: 'Kaarten laden is mislukt.',
          });
        }
      }
    }

    void loadSetCards();

    return () => {
      isCancelled = true;
    };
  }, [openSet]);

  async function loadSetCardsPage(setCode: string, page: number) {
    const requestId = setCardsRequestIdRef.current + 1;
    setCardsRequestIdRef.current = requestId;

    setSetCardsState((currentState) => ({
      ...currentState,
      status: 'loading',
      page,
      errorMessage: undefined,
    }));

    try {
      const result = await getSetCards(setCode, page);
      if (setCardsRequestIdRef.current === requestId) {
        setSetCardsState({ status: 'success', ...result });
      }
    } catch {
      if (setCardsRequestIdRef.current === requestId) {
        setSetCardsState((currentState) => ({
          ...currentState,
          status: 'error',
          errorMessage: 'Kaarten laden is mislukt.',
        }));
      }
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function loadSetsProgress() {
      setSetsProgressState({ status: 'loading', progressBySetCode: new Map() });

      try {
        const collectionReadiness = await checkCollectionReadiness();
        const collectionId = collectionReadiness.mainCollection?.id;

        if (collectionReadiness.status !== 'collection-ready' || !collectionId) {
          if (isMounted) {
            setSetsProgressState({ status: 'unavailable', progressBySetCode: new Map() });
          }

          return;
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
      setsWithMetadataCount: setsPageState.sets.filter((set) => set.release_date || set.total !== null).length,
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
                      const progressPercent = hasKnownSetTotal(set.total)
                        ? calculateProgressPercent(ownedCount, set.total)
                        : null;
                      const setImageUrl = set.logo_url ?? set.symbol_url;
                      const setImageAlt = set.logo_url ? `${set.name} logo` : `${set.name} symbool`;
                      const isOpen = openSetId === set.id;
                      const detailPanelId = `sets-page-set-details-${set.id}`;

                      return (
                        <li key={set.id} className={`sets-page-set-card${isOpen ? ' is-open' : ''}`}>
                          <button
                            type="button"
                            className="sets-page-set-summary-button"
                            aria-expanded={isOpen}
                            aria-controls={detailPanelId}
                            onClick={() => setOpenSetId(isOpen ? null : set.id)}
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
                                <span>{formatSetProgressText(ownedCount, set.total)}</span>
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

                          {isOpen ? (
                            <div id={detailPanelId} className="sets-page-set-details">
                              <dl>
                                <div>
                                  <dt>Setnaam</dt>
                                  <dd>{set.name}</dd>
                                </div>
                                {set.series ? (
                                  <div>
                                    <dt>Series</dt>
                                    <dd>{set.series}</dd>
                                  </div>
                                ) : null}
                                <div>
                                  <dt>Releasedatum</dt>
                                  <dd>{set.release_date ?? 'Onbekend'}</dd>
                                </div>
                                <div>
                                  <dt>Verzamelde kaarten</dt>
                                  <dd>{ownedCount}</dd>
                                </div>
                                {hasKnownSetTotal(set.total) ? (
                                  <div>
                                    <dt>Totaal aantal kaarten</dt>
                                    <dd>{set.total}</dd>
                                  </div>
                                ) : null}
                              </dl>

                              <div className="sets-page-set-cards" aria-label={`Cataloguskaarten voor ${set.name}`}>
                                {setCardsState.status === 'loading' ? (
                                  <p className="sets-page-set-cards-status" role="status" aria-live="polite">
                                    Kaarten laden…
                                  </p>
                                ) : null}

                                {setCardsState.status === 'error' ? (
                                  <div className="sets-page-set-cards-message" role="alert">
                                    <p>{setCardsState.errorMessage}</p>
                                    <button
                                      type="button"
                                      onClick={() => void loadSetCardsPage(set.set_code, setCardsState.page)}
                                    >
                                      Opnieuw proberen
                                    </button>
                                  </div>
                                ) : null}

                                {setCardsState.status === 'success' && setCardsState.totalCount === 0 ? (
                                  <p className="sets-page-set-cards-empty">
                                    Voor deze set zijn nog geen cataloguskaarten beschikbaar.
                                  </p>
                                ) : null}

                                {setCardsState.totalCount > 0 ? (
                                  <p className="sets-page-set-cards-count">
                                    {setCardsState.totalCount} cataloguskaarten beschikbaar
                                  </p>
                                ) : null}

                                {setCardsState.cards.length > 0 ? (
                                  <ul className="sets-page-set-cards-grid">
                                    {setCardsState.cards.map((card) => (
                                      <li key={card.id} className="sets-page-set-catalog-card">
                                        {card.image_small ? (
                                          <img
                                            src={card.image_small}
                                            alt={`${card.pokemon} kaart ${card.number ?? ''}`.trim()}
                                            width="72"
                                            height="100"
                                            loading="lazy"
                                            decoding="async"
                                          />
                                        ) : (
                                          <span className="sets-page-set-card-image-placeholder" aria-hidden="true">
                                            Geen afbeelding
                                          </span>
                                        )}
                                        <span className="sets-page-set-card-body">
                                          <strong>{card.pokemon}</strong>
                                          <span>Nr. {card.number ?? 'onbekend'}</span>
                                          {card.rarity ? <span>{card.rarity}</span> : null}
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                ) : null}

                                {setCardsState.totalPages > 1 ? (
                                  <nav className="sets-page-set-cards-pagination" aria-label="Cataloguskaartpagina's">
                                    <button
                                      type="button"
                                      disabled={setCardsState.page <= 1 || setCardsState.status === 'loading'}
                                      onClick={() => void loadSetCardsPage(set.set_code, setCardsState.page - 1)}
                                    >
                                      Vorige
                                    </button>
                                    <span>
                                      Pagina {setCardsState.page} van {setCardsState.totalPages}
                                    </span>
                                    <button
                                      type="button"
                                      disabled={
                                        setCardsState.page >= setCardsState.totalPages ||
                                        setCardsState.status === 'loading'
                                      }
                                      onClick={() => void loadSetCardsPage(set.set_code, setCardsState.page + 1)}
                                    >
                                      Volgende
                                    </button>
                                  </nav>
                                ) : null}
                              </div>
                            </div>
                          ) : null}
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
    </section>
  );
}
