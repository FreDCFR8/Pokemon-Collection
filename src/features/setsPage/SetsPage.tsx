import { useEffect, useMemo, useState } from 'react';

import { getSetsCatalog, type SetsCatalogRow } from '../../services/setsCatalogService';

type SetsPageState =
  | { status: 'loading'; sets: SetsCatalogRow[]; errorMessage?: undefined }
  | { status: 'success'; sets: SetsCatalogRow[]; errorMessage?: undefined }
  | { status: 'error'; sets: SetsCatalogRow[]; errorMessage: string };

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

export function SetsPage() {
  const [setsPageState, setSetsPageState] = useState<SetsPageState>({ status: 'loading', sets: [] });

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

  const catalogSummary = useMemo(
    () => ({
      loadedSetsCount: setsPageState.sets.length,
      setsWithMetadataCount: setsPageState.sets.filter((set) => set.release_date || set.total !== null).length,
    }),
    [setsPageState.sets],
  );

  const isLoading = setsPageState.status === 'loading';
  const isError = setsPageState.status === 'error';
  const isEmpty = setsPageState.status === 'success' && setsPageState.sets.length === 0;

  return (
    <section className="sets-page" aria-labelledby="sets-page-title">
      <div className="sets-page-hero">
        <p className="eyebrow">Set-catalogus</p>
        <h2 id="sets-page-title">Sets</h2>
        <p>Volledige set-catalogus, onafhankelijk van de Lars/Lore collectie.</p>
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

      <p className="sets-page-progress-note">Collectievoortgang per set volgt in een volgende fase.</p>

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

              return (
                <li key={set.id} className="sets-page-set-card">
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
                        <span className="sets-page-set-code">{set.set_code}</span>
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
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>
    </section>
  );
}
