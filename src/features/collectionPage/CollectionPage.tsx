import { useEffect, useMemo, useState } from 'react';
import { loadCollectionPage } from './collectionPageService';
import { COLLECTION_PAGE_SIZE, type CollectionPageState } from './collectionPageTypes';

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
  const [collectionPageState, setCollectionPageState] = useState<CollectionPageState>(initialCollectionPageState);
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(collectionPageState.totalCount / collectionPageState.pageSize)),
    [collectionPageState.pageSize, collectionPageState.totalCount],
  );
  const isLoading = collectionPageState.status === 'loading';
  const firstVisibleCard = collectionPageState.totalCount === 0 ? 0 : (collectionPageState.page - 1) * collectionPageState.pageSize + 1;
  const lastVisibleCard = Math.min(collectionPageState.page * collectionPageState.pageSize, collectionPageState.totalCount);

  useEffect(() => {
    let isMounted = true;

    setCollectionPageState(initialCollectionPageState);
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

      <p className="collection-page-legacy-note">Legacy collectiegegevens worden hier rustig read-only getoond; bewerken, zoeken en importeren blijven buiten deze fase.</p>

      <CollectionPagination
        currentPage={collectionPageState.page}
        isLoading={isLoading}
        label="Collectiepaginatie boven"
        onNextPage={goToNextPage}
        onPreviousPage={goToPreviousPage}
        totalPages={totalPages}
      />

      {collectionPageState.status === 'ready' && collectionPageState.cards.length === 0 ? (
        <p className="collection-page-empty">Nog geen kaarten in deze collectie.</p>
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
