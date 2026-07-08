import { useEffect, useMemo, useState } from 'react';
import { loadCollectionPage } from './collectionPageService';
import { COLLECTION_PAGE_SIZE, type CollectionPageState } from './collectionPageTypes';

const initialCollectionPageState: CollectionPageState = {
  status: 'loading',
  message: 'Collectiepagina wordt rustig geladen.',
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

function formatSetLine(setName: string | null, number: string | null): string {
  const setLabel = formatValue(setName);
  const numberLabel = formatValue(number);

  if (setLabel === '—' && numberLabel === '—') {
    return 'Set en nummer onbekend';
  }

  return `${setLabel} · #${numberLabel}`;
}

type CollectionPaginationProps = {
  currentPage: number;
  disabled: boolean;
  page: number;
  totalPages: number;
  onPrevious: () => void;
  onNext: () => void;
};

function CollectionPagination({
  currentPage,
  disabled,
  page,
  totalPages,
  onPrevious,
  onNext,
}: CollectionPaginationProps) {
  return (
    <nav className="collection-page-pagination" aria-label="Collectiepaginatie">
      <button type="button" onClick={onPrevious} disabled={disabled || page <= 1}>
        Previous
      </button>
      <span>
        Pagina {currentPage} van {totalPages}
      </span>
      <button type="button" onClick={onNext} disabled={disabled || page >= totalPages}>
        Next
      </button>
    </nav>
  );
}

export function CollectionPage() {
  const [page, setPage] = useState(1);
  const [collectionPageState, setCollectionPageState] = useState<CollectionPageState>(initialCollectionPageState);
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(collectionPageState.totalCount / collectionPageState.pageSize)),
    [collectionPageState.pageSize, collectionPageState.totalCount],
  );
  const isLoading = collectionPageState.status === 'loading';
  const hasCards = collectionPageState.cards.length > 0;
  const handlePreviousPage = () => setPage((currentPage) => Math.max(1, currentPage - 1));
  const handleNextPage = () => setPage((currentPage) => Math.min(totalPages, currentPage + 1));

  useEffect(() => {
    let isMounted = true;

    setCollectionPageState((currentState) => ({
      ...initialCollectionPageState,
      totalCount: currentState.totalCount,
      page,
      pageSize: COLLECTION_PAGE_SIZE,
    }));
    loadCollectionPage(page).then((nextState) => {
      if (isMounted) {
        setCollectionPageState(nextState);
        setPage(nextState.page);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [page]);

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
          <dt>Totaal aantal kaarten</dt>
          <dd>{collectionPageState.totalCount}</dd>
        </div>
        <div>
          <dt>Huidige pagina</dt>
          <dd>{collectionPageState.page} / {totalPages}</dd>
        </div>
        <div>
          <dt>Kaarten per pagina</dt>
          <dd>{collectionPageState.pageSize}</dd>
        </div>
      </dl>

      <p className="collection-page-legacy-note">
        Sommige kaartgegevens komen nog uit legacy-import en worden later opgeschoond.
      </p>

      <CollectionPagination
        currentPage={collectionPageState.page}
        disabled={isLoading}
        page={page}
        totalPages={totalPages}
        onPrevious={handlePreviousPage}
        onNext={handleNextPage}
      />

      {isLoading ? <p className="collection-page-loading">Kaarten worden geladen…</p> : null}

      {collectionPageState.status === 'ready' && collectionPageState.cards.length === 0 ? (
        <p className="collection-page-empty">Nog geen kaarten in deze collectie.</p>
      ) : null}

      {hasCards ? (
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
                  <p className="collection-page-card-set">{formatSetLine(card.setName, card.number)}</p>
                  <p className="collection-page-card-rarity">Rarity: {formatValue(card.rarity)}</p>
                  <dl className="collection-page-card-meta">
                    <div><dt>Aantal</dt><dd>{formatValue(card.quantity)}</dd></div>
                    <div><dt>Status</dt><dd>{formatValue(card.status)}</dd></div>
                    <div><dt>Conditie</dt><dd>{formatValue(card.condition)}</dd></div>
                  </dl>
                </div>
              </li>
            ))}
          </ul>

          <CollectionPagination
            currentPage={collectionPageState.page}
            disabled={isLoading}
            page={page}
            totalPages={totalPages}
            onPrevious={handlePreviousPage}
            onNext={handleNextPage}
          />
        </>
      ) : null}
    </section>
  );
}
