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

export function CollectionPage() {
  const [page, setPage] = useState(1);
  const [collectionPageState, setCollectionPageState] = useState<CollectionPageState>(initialCollectionPageState);
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(collectionPageState.totalCount / collectionPageState.pageSize)),
    [collectionPageState.pageSize, collectionPageState.totalCount],
  );

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

      <dl className="collection-page-summary">
        <div>
          <dt>Totaal kaarten</dt>
          <dd>{collectionPageState.totalCount}</dd>
        </div>
        <div>
          <dt>Pagina</dt>
          <dd>{collectionPageState.page} / {totalPages}</dd>
        </div>
        <div>
          <dt>Page size</dt>
          <dd>{collectionPageState.pageSize}</dd>
        </div>
      </dl>

      <div className="collection-page-pagination" aria-label="Collectiepaginatie">
        <button type="button" onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))} disabled={collectionPageState.status === 'loading' || page <= 1}>
          Previous
        </button>
        <span>Pagina {collectionPageState.page}</span>
        <button type="button" onClick={() => setPage((currentPage) => currentPage + 1)} disabled={collectionPageState.status === 'loading' || page >= totalPages}>
          Next
        </button>
      </div>

      {collectionPageState.status === 'ready' && collectionPageState.cards.length === 0 ? (
        <p className="collection-page-empty">Nog geen kaarten in deze collectie.</p>
      ) : null}

      {collectionPageState.cards.length > 0 ? (
        <ul className="collection-page-grid" aria-label="Collectiekaarten">
          {collectionPageState.cards.map((card, index) => (
            <li key={`${card.pokemon ?? 'kaart'}-${card.setName ?? 'set'}-${card.number ?? index}-${index}`}>
              {card.imageSmall ? (
                <img src={card.imageSmall} alt={card.pokemon ? `${card.pokemon} kaart` : 'Collectiekaart'} loading="lazy" />
              ) : (
                <div className="card-image-placeholder">Geen afbeelding</div>
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
      ) : null}
    </section>
  );
}
