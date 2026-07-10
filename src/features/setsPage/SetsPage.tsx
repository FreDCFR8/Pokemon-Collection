import { useEffect, useMemo, useState } from 'react';

import { checkCollectionReadiness } from '../collections';
import { getSetsCatalog, type SetsCatalogRow } from '../../services/setsCatalogService';
import { getSetProgressForCollection, type SetProgress } from './services/setsProgressService';

type SetsPageState =
  | { status: 'loading'; sets: SetsCatalogRow[]; errorMessage?: undefined }
  | { status: 'success'; sets: SetsCatalogRow[]; errorMessage?: undefined }
  | { status: 'error'; sets: SetsCatalogRow[]; errorMessage: string };

type SetsProgressState = {
  status: 'idle' | 'loading' | 'success' | 'unavailable';
  progressBySetCode: Map<string, SetProgress>;
};

function formatSetDate(releaseDate: string | null) {
  if (!releaseDate) {
    return null;
  }

  return new Intl.DateTimeFormat('nl-NL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(releaseDate));
}

function formatCardTotalText(set: SetsCatalogRow) {
  if (set.printed_total !== null && set.total !== null) {
    return `${set.printed_total} gedrukt / ${set.total} totaal`;
  }

  if (set.printed_total !== null) {
    return `${set.printed_total} gedrukt`;
  }

  if (set.total !== null) {
    return `${set.total} totaal`;
  }

  return null;
}

function formatProgressText(progress: SetProgress) {
  if (progress.total !== null) {
    const percentage = progress.progressPercent !== null ? ` (${progress.progressPercent}%)` : '';

    return `${progress.ownedCount} / ${progress.total} kaarten${percentage}`;
  }

  return `${progress.ownedCount} kaarten`;
}

export function SetsPage() {
  const [setsPageState, setSetsPageState] = useState<SetsPageState>({ status: 'loading', sets: [] });
  const [setsProgressState, setSetsProgressState] = useState<SetsProgressState>({
    status: 'idle',
    progressBySetCode: new Map(),
  });
  const [selectedSetCode, setSelectedSetCode] = useState<string | null>(null);

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

  const selectedSet = useMemo(
    () => setsPageState.sets.find((set) => set.set_code === selectedSetCode) ?? null,
    [selectedSetCode, setsPageState.sets],
  );

  const selectedSetProgress = selectedSet
    ? setsProgressState.progressBySetCode.get(selectedSet.set_code) ?? null
    : null;
  const selectedSetReleaseDate = selectedSet ? formatSetDate(selectedSet.release_date) : null;
  const selectedSetCardTotal = selectedSet ? formatCardTotalText(selectedSet) : null;

  const isLoading = setsPageState.status === 'loading';
  const isError = setsPageState.status === 'error';
  const isEmpty = setsPageState.status === 'success' && setsPageState.sets.length === 0;

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

      {selectedSet ? (
        <section className="sets-page-detail" aria-labelledby="sets-page-detail-title">
          <div className="sets-page-detail-header">
            <div className="sets-page-set-title-group">
              {selectedSet.symbol_url ? (
                <img
                  className="sets-page-set-symbol"
                  src={selectedSet.symbol_url}
                  alt={`${selectedSet.name} symbool`}
                  width="32"
                  height="32"
                />
              ) : null}
              <div>
                <p className="eyebrow">Geselecteerde set</p>
                <h3 id="sets-page-detail-title">{selectedSet.name}</h3>
                <span className="sets-page-set-code">{selectedSet.set_code}</span>
              </div>
            </div>

            {selectedSet.logo_url ? (
              <img
                className="sets-page-detail-logo"
                src={selectedSet.logo_url}
                alt={`${selectedSet.name} logo`}
                width="160"
                height="64"
              />
            ) : null}
          </div>

          <dl className="sets-page-set-details sets-page-detail-metadata">
            {selectedSetReleaseDate ? (
              <div>
                <dt>Release date</dt>
                <dd>{selectedSetReleaseDate}</dd>
              </div>
            ) : null}
            {selectedSetCardTotal ? (
              <div>
                <dt>Kaarten</dt>
                <dd>{selectedSetCardTotal}</dd>
              </div>
            ) : null}
            {selectedSetProgress ? (
              <div>
                <dt>Collectievoortgang</dt>
                <dd>{formatProgressText(selectedSetProgress)}</dd>
              </div>
            ) : null}
          </dl>

          <p className="sets-page-detail-placeholder">Kaarten in deze set volgt in een volgende fase.</p>

          <button
            className="sets-page-detail-close"
            type="button"
            onClick={() => setSelectedSetCode(null)}
            aria-label={`Detail sluiten voor ${selectedSet.name}`}
          >
            Detail sluiten
          </button>
        </section>
      ) : null}

      <section className="sets-page-card" aria-labelledby="sets-page-catalog-title">
        <h3 id="sets-page-catalog-title">Set-catalog</h3>

        {isLoading ? <p role="status">Sets worden geladen...</p> : null}

        {isError ? (
          <p role="alert">Fout bij het laden van de sets: {setsPageState.errorMessage}</p>
        ) : null}

        {isEmpty ? <p>Er zijn nog geen sets beschikbaar in de catalog.</p> : null}

        {setsPageState.sets.length > 0 ? (
          <ul className="sets-page-catalog-grid" aria-label="Beschikbare sets">
            {setsPageState.sets.map((set) => {
              const formattedReleaseDate = formatSetDate(set.release_date);
              const setProgress = setsProgressState.progressBySetCode.get(set.set_code);
              const progressBarValue = setProgress?.progressPercent ?? 0;

              return (
                <li key={set.id}>
                  <button
                    className="sets-page-set-card"
                    type="button"
                    onClick={() => setSelectedSetCode(set.set_code)}
                    aria-label={`Open detail voor ${set.name}`}
                    aria-pressed={selectedSetCode === set.set_code}
                  >
                    <div className="sets-page-set-card-header">
                      <div className="sets-page-set-title-group">
                        {set.symbol_url ? (
                          <img
                            className="sets-page-set-symbol"
                            src={set.symbol_url}
                            alt={`${set.name} symbool`}
                            width="32"
                            height="32"
                            loading="lazy"
                          />
                        ) : null}
                        <div>
                          <strong className="sets-page-set-name">{set.name}</strong>
                        </div>
                      </div>

                      {set.logo_url ? (
                        <img
                          className="sets-page-set-logo"
                          src={set.logo_url}
                          alt={`${set.name} logo`}
                          width="120"
                          height="48"
                          loading="lazy"
                        />
                      ) : null}
                    </div>

                    <dl className="sets-page-set-details">
                      {set.series ? (
                        <div>
                          <dt>Series</dt>
                          <dd>{set.series}</dd>
                        </div>
                      ) : null}
                      {formattedReleaseDate ? (
                        <div>
                          <dt>Release date</dt>
                          <dd>{formattedReleaseDate}</dd>
                        </div>
                      ) : null}
                      {set.total !== null ? (
                        <div>
                          <dt>Kaarten in set</dt>
                          <dd>{set.total}</dd>
                        </div>
                      ) : null}
                    </dl>

                    {setProgress ? (
                      <div className="sets-page-set-progress" aria-label={`Collectievoortgang voor ${set.name}`}>
                        <span>{formatProgressText(setProgress)}</span>
                        {setProgress.progressPercent !== null ? (
                          <div
                            className="sets-page-set-progress-bar"
                            role="progressbar"
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={setProgress.progressPercent}
                            aria-label={`${setProgress.progressPercent}% compleet`}
                          >
                            <span style={{ width: `${progressBarValue}%` }} />
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>
    </section>
  );
}
