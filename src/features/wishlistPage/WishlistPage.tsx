import { useEffect, useRef, useState } from 'react';
import { CardDetailDialog, type CardDetailCard } from '../cardDetail';
import { getCollectionCardOwnershipForCatalogCards, type CollectionOwnershipState } from '../collectionCards';
import { createWishlistCardDetailProductCopy, toWishlistCardDetailCard } from './wishlistCardDetailAdapter';
import { loadWishlistPage } from './wishlistPageService';
import { type WishlistPageCard, type WishlistPageState } from './wishlistPageTypes';

const initialState: WishlistPageState = {
  status: 'loading',
  message: 'Wishlist wordt voorbereid.',
  totalCount: 0,
  cards: [],
  collectionId: null,
};

export function WishlistPage() {
  const [pageState, setPageState] = useState(initialState);
  const [selectedCard, setSelectedCard] = useState<CardDetailCard | null>(null);
  const [ownership, setOwnership] = useState<CollectionOwnershipState>({ status: 'idle' });
  const requestIdRef = useRef(0);
  const cardButtonRefs = useRef(new Map<string, HTMLButtonElement>());

  useEffect(() => {
    let isMounted = true;
    setPageState(initialState);
    loadWishlistPage().then((nextState) => {
      if (isMounted) setPageState(nextState);
    });
    return () => { isMounted = false; };
  }, []);

  const loadSelectedOwnership = (card: CardDetailCard, collectionId: string) => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const previous = ownership.status === 'ready' ? ownership.value : ownership.status === 'error' || ownership.status === 'loading' ? ownership.previous : undefined;
    setOwnership({ status: 'loading', previous });

    getCollectionCardOwnershipForCatalogCards({ collectionId, cardCatalogIds: [card.cardCatalogId] })
      .then((result) => {
        if (requestIdRef.current !== requestId) return;
        const value = result.get(card.cardCatalogId);
        setOwnership(value && value.kind !== 'conflict' ? { status: 'ready', value } : { status: 'error', previous, retryable: true });
      })
      .catch(() => {
        if (requestIdRef.current === requestId) setOwnership({ status: 'error', previous, retryable: true });
      });
  };

  const openDetail = (card: WishlistPageCard) => {
    const detailCard = toWishlistCardDetailCard(card);
    if (!detailCard || !pageState.collectionId) return;
    setSelectedCard(detailCard);
    loadSelectedOwnership(detailCard, pageState.collectionId);
  };

  const closeDetail = () => {
    const closingId = selectedCard?.cardCatalogId;
    requestIdRef.current += 1;
    setSelectedCard(null);
    setOwnership({ status: 'idle' });
    window.setTimeout(() => {
      if (closingId) cardButtonRefs.current.get(closingId)?.focus();
    }, 0);
  };

  return (
    <>
      <section className="collection-page wishlist-page" aria-labelledby="wishlist-page-title" inert={selectedCard ? true : undefined} aria-hidden={selectedCard ? true : undefined}>
        <div className="collection-page-header">
          <div>
            <p className="eyebrow">Read-only wishlist</p>
            <h2 id="wishlist-page-title">Wishlist</h2>
            <p>{pageState.message}</p>
            {pageState.errorMessage ? <p className="status-note">Foutmelding: {pageState.errorMessage}</p> : null}
          </div>
        </div>

        {pageState.status === 'ready' && pageState.cards.length === 0 ? <div className="collection-page-empty"><p>Je wishlist bevat nog geen kaarten.</p></div> : null}

        {pageState.cards.length > 0 ? (
          <ul className="collection-page-grid wishlist-page-grid" aria-label="Wishlistkaarten">
            {pageState.cards.map((card) => {
              const titleId = `wishlist-card-${card.cardCatalogId}-title`;
              return (
                <li key={card.cardCatalogId}>
                  {card.imageSmall ? <img src={card.imageSmall} alt={card.pokemon ? `${card.pokemon} kaart` : 'Wishlistkaart'} loading="lazy" /> : <div className="card-image-placeholder" aria-label="Geen afbeelding beschikbaar">Geen afbeelding</div>}
                  <h3 id={titleId} className="wishlist-page-card-title">{card.pokemon || 'Onbekende kaart'}</h3>
                  <button
                    ref={(element) => {
                      if (element) cardButtonRefs.current.set(card.cardCatalogId, element);
                      else cardButtonRefs.current.delete(card.cardCatalogId);
                    }}
                    className="collection-page-card-button"
                    type="button"
                    aria-labelledby={titleId}
                    onClick={() => openDetail(card)}
                  />
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>

      {selectedCard ? (
        <CardDetailDialog
          card={selectedCard}
          ownership={ownership}
          mutation={{ status: 'idle' }}
          capabilities={{ canAdd: false, canIncrease: false, canDecrease: false }}
          copy={createWishlistCardDetailProductCopy(ownership)}
          readOnly
          onClose={closeDetail}
          onRetryOwnership={() => {
            if (pageState.collectionId) loadSelectedOwnership(selectedCard, pageState.collectionId);
          }}
        />
      ) : null}
    </>
  );
}
