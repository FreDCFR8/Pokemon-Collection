import { useCallback, useEffect, useState } from 'react';
import { checkCollectionReadiness } from './collectionReadinessService';
import type { CollectionReadinessState } from './collectionReadinessTypes';

const initialCollectionReadiness: CollectionReadinessState = {
  status: 'loading',
  message: 'Collectiecontrole wordt gestart.',
  collections: [],
  mainCollection: null,
};

export function CollectionReadinessCard() {
  const [readiness, setReadiness] = useState<CollectionReadinessState>(initialCollectionReadiness);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshCollectionReadiness = useCallback(async () => {
    setIsRefreshing(true);
    setReadiness((currentReadiness) => ({
      ...currentReadiness,
      status: 'loading',
      message: 'Collectiecontrole wordt uitgevoerd.',
      errorMessage: undefined,
    }));

    const nextReadiness = await checkCollectionReadiness();
    setReadiness(nextReadiness);
    setIsRefreshing(false);
  }, []);

  useEffect(() => {
    let isMounted = true;

    setReadiness(initialCollectionReadiness);
    checkCollectionReadiness().then((nextReadiness) => {
      if (isMounted) {
        setReadiness(nextReadiness);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <section className="collection-readiness-card" aria-labelledby="collection-readiness-title">
      <p className="eyebrow">Collection readiness</p>
      <h2 id="collection-readiness-title">Echte collectiecontrole</h2>
      <p>{readiness.message}</p>
      {readiness.errorMessage ? <p className="status-note">Foutmelding: {readiness.errorMessage}</p> : null}

      <dl className="status-list">
        <div>
          <dt>Status</dt>
          <dd>{readiness.status}</dd>
        </div>
        <div>
          <dt>cards_catalog</dt>
          <dd>Niet gebruikt</dd>
        </div>
        <div>
          <dt>collection_cards</dt>
          <dd>Niet gebruikt</dd>
        </div>
        <div>
          <dt>public.cards</dt>
          <dd>Niet gebruikt</dd>
        </div>
        <div>
          <dt>Kaartgegevens</dt>
          <dd>Niet geladen</dd>
        </div>
      </dl>

      {readiness.mainCollection ? (
        <dl className="collection-readiness-details" aria-label="Gevonden hoofdcollectie">
          <div>
            <dt>Hoofdcollectie</dt>
            <dd>{readiness.mainCollection.name}</dd>
          </div>
          <div>
            <dt>Type</dt>
            <dd>{readiness.mainCollection.type}</dd>
          </div>
        </dl>
      ) : null}

      {readiness.collections.length > 0 ? (
        <ul className="collection-list" aria-label="Gevonden collecties">
          {readiness.collections.map((collection) => (
            <li key={collection.id}>
              <span>{collection.name}</span>
              <strong>{collection.type}</strong>
            </li>
          ))}
        </ul>
      ) : null}

      <button
        className="collection-readiness-refresh"
        type="button"
        onClick={refreshCollectionReadiness}
        disabled={isRefreshing}
      >
        {isRefreshing ? 'Collecties controleren…' : 'Collecties opnieuw controleren'}
      </button>
    </section>
  );
}
