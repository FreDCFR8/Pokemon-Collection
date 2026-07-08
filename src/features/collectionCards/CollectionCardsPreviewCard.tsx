import { useCallback, useEffect, useState } from 'react';
import { loadCollectionCardsPreview } from './collectionCardsPreviewService';
import type { CollectionCardsPreviewState } from './collectionCardsPreviewTypes';

const initialPreviewState: CollectionCardsPreviewState = {
  status: 'loading',
  message: 'Kaartenpreview wordt voorbereid.',
  totalCount: 0,
  previewCards: [],
};

function formatCardTitle(pokemon: string | null): string {
  return pokemon?.trim() || 'Onbekende kaart';
}

function formatMetaValue(value: string | number | null): string {
  if (value === null || value === '') {
    return '—';
  }

  return String(value);
}

export function CollectionCardsPreviewCard() {
  const [previewState, setPreviewState] = useState<CollectionCardsPreviewState>(initialPreviewState);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshPreview = useCallback(async () => {
    setIsRefreshing(true);
    setPreviewState((currentState) => ({
      ...currentState,
      status: 'loading',
      message: 'Kaartenpreview wordt geladen.',
      errorMessage: undefined,
    }));

    const nextState = await loadCollectionCardsPreview();
    setPreviewState(nextState);
    setIsRefreshing(false);
  }, []);

  useEffect(() => {
    let isMounted = true;

    setPreviewState(initialPreviewState);
    loadCollectionCardsPreview().then((nextState) => {
      if (isMounted) {
        setPreviewState(nextState);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <section className="collection-cards-preview-card" aria-labelledby="collection-cards-preview-title">
      <p className="eyebrow">Collection cards preview</p>
      <h2 id="collection-cards-preview-title">Kaarten preview</h2>
      <p>{previewState.message}</p>
      {previewState.errorMessage ? <p className="status-note">Foutmelding: {previewState.errorMessage}</p> : null}

      <dl className="status-list">
        <div>
          <dt>Status</dt>
          <dd>{previewState.status}</dd>
        </div>
        <div>
          <dt>Totaal collection cards</dt>
          <dd>{previewState.totalCount}</dd>
        </div>
        <div>
          <dt>public.cards</dt>
          <dd>Niet gebruikt</dd>
        </div>
        <div>
          <dt>Schrijfacties</dt>
          <dd>Niet beschikbaar</dd>
        </div>
        <div>
          <dt>Volledige galerij</dt>
          <dd>Nog niet actief</dd>
        </div>
      </dl>

      {previewState.status === 'ready' && previewState.previewCards.length === 0 ? (
        <p className="empty-preview">Nog geen kaarten in deze collectie.</p>
      ) : null}

      {previewState.previewCards.length > 0 ? (
        <ul className="collection-cards-preview-list" aria-label="Kaarten previewlijst">
          {previewState.previewCards.map((card, index) => (
            <li key={`${card.pokemon ?? 'kaart'}-${card.setName ?? 'set'}-${card.number ?? index}`}>
              {card.imageSmall ? <img src={card.imageSmall} alt="" loading="lazy" /> : <div className="card-image-placeholder">Geen afbeelding</div>}
              <div>
                <h3>{formatCardTitle(card.pokemon)}</h3>
                <p>
                  {formatMetaValue(card.setName)} · #{formatMetaValue(card.number)} · {formatMetaValue(card.rarity)}
                </p>
                <dl className="collection-card-meta">
                  <div>
                    <dt>Aantal</dt>
                    <dd>{formatMetaValue(card.quantity)}</dd>
                  </div>
                  <div>
                    <dt>Conditie</dt>
                    <dd>{formatMetaValue(card.condition)}</dd>
                  </div>
                  <div>
                    <dt>Status</dt>
                    <dd>{formatMetaValue(card.status)}</dd>
                  </div>
                  <div>
                    <dt>Toegevoegd</dt>
                    <dd>{formatMetaValue(card.addedAt)}</dd>
                  </div>
                </dl>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <button className="collection-cards-preview-refresh" type="button" onClick={refreshPreview} disabled={isRefreshing}>
        {isRefreshing ? 'Kaarten laden…' : 'Kaartenpreview opnieuw laden'}
      </button>
    </section>
  );
}
