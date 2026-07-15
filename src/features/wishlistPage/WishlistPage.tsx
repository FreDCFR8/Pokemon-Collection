import { useEffect, useRef, useState } from 'react';
import { CardDetailDialog, type CardDetailCard, type CardDetailMutationState } from '../cardDetail';
import { getCollectionCardOwnershipForCatalogCards, promoteWishlistToOwned, removeCardFromWishlist, WishlistMutationError, WishlistPromotionError, type CollectionOwnershipState } from '../collectionCards';
import { createWishlistCardDetailProductCopy, toWishlistCardDetailCard } from './wishlistCardDetailAdapter';
import { loadWishlistPage } from './wishlistPageService';
import { BinderCardGrid } from '../../components/BinderCardGrid';
import { createWishlistPageErrorState, createWishlistPageLoadingState, resolveWishlistRemovalRecovery, shouldApplyWishlistDetailResponse, WISHLIST_PAGE_SIZE, type WishlistPageCard, type WishlistPageState } from './wishlistPageTypes';

const initialState: WishlistPageState = {
  status: 'loading',
  message: 'Wishlist wordt voorbereid.',
  totalCount: 0,
  page: 1,
  pageSize: WISHLIST_PAGE_SIZE,
  cards: [],
  collectionId: null,
};

export function WishlistPage() {
  const [pageState, setPageState] = useState(initialState);
  const [page, setPage] = useState(1);
  const [retryNonce, setRetryNonce] = useState(0);
  const [selectedCard, setSelectedCard] = useState<CardDetailCard | null>(null);
  const [ownership, setOwnership] = useState<CollectionOwnershipState>({ status: 'idle' });
  const [detailMutation, setDetailMutation] = useState<CardDetailMutationState>({ status: 'idle' });
  const requestIdRef = useRef(0);
  const pageLoadRequestIdRef = useRef(0);
  const activePageRef = useRef(1);
  const mutationRequestIdRef = useRef(0);
  const selectedCardIdRef = useRef<string | null>(null);
  const selectedCollectionIdRef = useRef<string | null>(null);
  const cardButtonRefs = useRef(new Map<string, HTMLButtonElement>());

  useEffect(() => {
    let isMounted = true;
    activePageRef.current = page;
    const pageLoadRequestId = pageLoadRequestIdRef.current + 1;
    pageLoadRequestIdRef.current = pageLoadRequestId;
    setPageState(createWishlistPageLoadingState(page));
    loadWishlistPage(page)
      .then((nextState) => {
        if (isMounted && pageLoadRequestIdRef.current === pageLoadRequestId) {
          setPageState(nextState);
          setPage(nextState.page);
        }
      })
      .catch((error: unknown) => {
        if (isMounted && pageLoadRequestIdRef.current === pageLoadRequestId) {
          setPageState(createWishlistPageErrorState(page, error instanceof Error ? error.message : 'Onbekende wishlistfout.'));
        }
      });
    return () => { isMounted = false; };
  }, [page, retryNonce]);

  const totalPages = Math.max(1, Math.ceil(pageState.totalCount / pageState.pageSize));
  const isLoading = pageState.status === 'loading';

  const retryWishlist = () => setRetryNonce((current) => current + 1);
  const goToPreviousPage = () => setPage((current) => Math.max(1, current - 1));
  const goToNextPage = () => setPage((current) => Math.min(totalPages, current + 1));

  const loadSelectedOwnership = async (card: CardDetailCard, collectionId: string) => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const previous = ownership.status === 'ready' ? ownership.value : ownership.status === 'error' || ownership.status === 'loading' ? ownership.previous : undefined;
    setOwnership({ status: 'loading', previous });

    try {
      const result = await getCollectionCardOwnershipForCatalogCards({ collectionId, cardCatalogIds: [card.cardCatalogId] });
      const value = result.get(card.cardCatalogId);
      if (requestIdRef.current !== requestId) return null;
      setOwnership(value && value.kind !== 'conflict' ? { status: 'ready', value } : { status: 'error', previous, retryable: true });
      return value ?? { kind: 'conflict' as const, reason: 'Geen bevestigde ownershiprespons.' };
    } catch {
      if (requestIdRef.current === requestId) setOwnership({ status: 'error', previous, retryable: true });
      return null;
    }
  };

  const openDetail = (card: WishlistPageCard) => {
    const detailCard = toWishlistCardDetailCard(card);
    if (!detailCard || !pageState.collectionId) return;
    selectedCardIdRef.current = detailCard.cardCatalogId;
    selectedCollectionIdRef.current = pageState.collectionId;
    mutationRequestIdRef.current += 1;
    setSelectedCard(detailCard);
    loadSelectedOwnership(detailCard, pageState.collectionId);
  };

  const closeDetail = () => {
    const closingId = selectedCard?.cardCatalogId;
    requestIdRef.current += 1;
    mutationRequestIdRef.current += 1;
    selectedCardIdRef.current = null;
    selectedCollectionIdRef.current = null;
    setSelectedCard(null);
    setOwnership({ status: 'idle' });
    setDetailMutation({ status: 'idle' });
    window.setTimeout(() => {
      if (closingId) cardButtonRefs.current.get(closingId)?.focus();
    }, 0);
  };

  const recoverAfterWishlistRemovalFailure = async (
    card: CardDetailCard,
    collectionId: string,
    mutationRequestId: number,
    pageAtStart: number,
  ) => {
    setDetailMutation({ status: 'conflict', operation: 'remove-wishlist', refreshStatus: 'pending', message: 'Wishliststatus wordt opnieuw gecontroleerd.' });
    const refreshedOwnership = await loadSelectedOwnership(card, collectionId);
    if (!shouldApplyWishlistDetailResponse(
      { mutationRequestId, cardCatalogId: card.cardCatalogId, collectionId, page: pageAtStart },
      { mutationRequestId: mutationRequestIdRef.current, cardCatalogId: selectedCardIdRef.current ?? '', collectionId: selectedCollectionIdRef.current ?? '', page: activePageRef.current },
    )) return;

    setRetryNonce((current) => current + 1);
    const recovery = resolveWishlistRemovalRecovery(refreshedOwnership);
    if (recovery === 'blocked' && (!refreshedOwnership || refreshedOwnership.kind === 'conflict')) {
      setDetailMutation({ status: 'conflict', operation: 'remove-wishlist', refreshStatus: 'error', message: 'Wishliststatus kon niet veilig worden vernieuwd.' });
      return;
    }
    if (recovery === 'close') {
      closeDetail();
      return;
    }
    if (recovery === 'retry-remove') {
      setDetailMutation({ status: 'error', operation: 'remove-wishlist', retryable: true, message: 'De wishlistrij bestaat nog. Probeer verwijderen opnieuw.' });
      return;
    }
    setDetailMutation({ status: 'conflict', operation: 'remove-wishlist', refreshStatus: 'ready', message: 'Meerdere wishlistrijen bestaan voor deze kaart; verwijderen is geblokkeerd.' });
  };

  const removeSelectedWishlistCard = async () => {
    const card = selectedCard;
    const collectionId = pageState.collectionId;
    const pageAtStart = page;
    if (!card || !collectionId || ownership.status !== 'ready' || ownership.value.kind !== 'snapshot') return;
    if (ownership.value.value.byStatus.wishlist.length !== 1 || detailMutation.status === 'pending' || detailMutation.status === 'conflict') return;

    const mutationRequestId = mutationRequestIdRef.current + 1;
    mutationRequestIdRef.current = mutationRequestId;
    setDetailMutation({ status: 'pending', operation: 'remove-wishlist' });

    try {
      const result = await removeCardFromWishlist({ collectionId, cardCatalogId: card.cardCatalogId });
      if (!shouldApplyWishlistDetailResponse(
        { mutationRequestId, cardCatalogId: card.cardCatalogId, collectionId, page: pageAtStart },
        { mutationRequestId: mutationRequestIdRef.current, cardCatalogId: selectedCardIdRef.current ?? '', collectionId: selectedCollectionIdRef.current ?? '', page: activePageRef.current },
      )) return;
      if (result.collectionCardId.trim() === '' || result.collectionId !== collectionId || result.cardCatalogId !== card.cardCatalogId || result.status !== 'wishlist' || result.quantity !== 1 || result.condition !== null) {
        throw new WishlistMutationError('De verwijderde wishlistrespons kon niet veilig worden bevestigd.', 'invalid-result');
      }

      setDetailMutation({ status: 'success', message: 'Van wishlist verwijderd' });
      closeDetail();
      setRetryNonce((current) => current + 1);
    } catch (error: unknown) {
      if (!shouldApplyWishlistDetailResponse(
        { mutationRequestId, cardCatalogId: card.cardCatalogId, collectionId, page: pageAtStart },
        { mutationRequestId: mutationRequestIdRef.current, cardCatalogId: selectedCardIdRef.current ?? '', collectionId: selectedCollectionIdRef.current ?? '', page: activePageRef.current },
      )) return;
      if (error instanceof WishlistMutationError && (error.reason === 'stale' || error.reason === 'duplicate' || error.reason === 'invalid-result')) {
        await recoverAfterWishlistRemovalFailure(card, collectionId, mutationRequestId, pageAtStart);
        return;
      }
      setDetailMutation({
        status: 'error',
        operation: 'remove-wishlist',
        retryable: true,
        message: error instanceof WishlistMutationError && error.reason === 'stale'
          ? 'Wishliststatus is intussen gewijzigd. Probeer opnieuw.'
          : 'Wishlist verwijderen is mislukt. Probeer opnieuw.',
      });
    }
  };

  const promoteSelectedWishlistCard = async () => {
    const card = selectedCard;
    const collectionId = pageState.collectionId;
    const pageAtStart = page;
    if (!card || !collectionId || ownership.status !== 'ready' || ownership.value.kind !== 'snapshot' || ownership.value.value.byStatus.wishlist.length !== 1 || ownership.value.value.byStatus.owned.length > 0 || ownership.value.value.byStatus.trade.length > 0 || ownership.value.value.byStatus.missing.length > 0 || detailMutation.status === 'pending' || detailMutation.status === 'conflict') return;
    const mutationRequestId = mutationRequestIdRef.current + 1;
    mutationRequestIdRef.current = mutationRequestId;
    setDetailMutation({ status: 'pending', operation: 'promote-wishlist' });
    try {
      const result = await promoteWishlistToOwned({ collectionId, cardCatalogId: card.cardCatalogId });
      if (result.collectionId !== collectionId || result.cardCatalogId !== card.cardCatalogId || result.quantity !== 1 || result.condition !== 'Near Mint' || result.status !== 'owned') throw new WishlistPromotionError('De promotierespons kon niet veilig worden bevestigd.', 'invalid-result');
      if (!shouldApplyWishlistDetailResponse({ mutationRequestId, cardCatalogId: card.cardCatalogId, collectionId, page: pageAtStart }, { mutationRequestId: mutationRequestIdRef.current, cardCatalogId: selectedCardIdRef.current ?? '', collectionId: selectedCollectionIdRef.current ?? '', page: activePageRef.current })) return;
      closeDetail();
      setRetryNonce((current) => current + 1);
    } catch (error: unknown) {
      if (!shouldApplyWishlistDetailResponse({ mutationRequestId, cardCatalogId: card.cardCatalogId, collectionId, page: pageAtStart }, { mutationRequestId: mutationRequestIdRef.current, cardCatalogId: selectedCardIdRef.current ?? '', collectionId: selectedCollectionIdRef.current ?? '', page: activePageRef.current })) return;
      setDetailMutation({ status: 'error', operation: 'promote-wishlist', retryable: true, message: error instanceof WishlistPromotionError && error.reason === 'conflict' ? 'Wishliststatus is intussen gewijzigd. Vernieuw de status en probeer opnieuw.' : 'Toevoegen aan collectie is mislukt. Probeer opnieuw.' });
      if (error instanceof WishlistPromotionError && error.reason !== 'not-ready') await loadSelectedOwnership(card, collectionId);
    }
  };

  return (
    <>
      <section className="collection-page wishlist-page" aria-labelledby="wishlist-page-title" inert={selectedCard ? true : undefined} aria-hidden={selectedCard ? true : undefined}>
        <div className="collection-page-header">
          <div>
            <p className="eyebrow">Wishlist</p>
            <h2 id="wishlist-page-title">Wishlist</h2>
            <p>{pageState.message}</p>
            {pageState.errorMessage ? <p className="status-note">Foutmelding: {pageState.errorMessage}</p> : null}
            {pageState.status === 'error' ? <button type="button" onClick={retryWishlist}>Wishlist opnieuw laden</button> : null}
          </div>
        </div>

        {pageState.status === 'ready' ? (
          <nav className="collection-page-pagination" aria-label="Wishlistpaginatie boven">
            <button type="button" onClick={goToPreviousPage} disabled={isLoading || pageState.page <= 1}>Previous</button>
            <span>Pagina {pageState.page} van {totalPages}</span>
            <button type="button" onClick={goToNextPage} disabled={isLoading || pageState.page >= totalPages}>Next</button>
          </nav>
        ) : null}

        {pageState.status === 'ready' && pageState.cards.length === 0 ? <div className="collection-page-empty"><p>Je wishlist bevat nog geen kaarten.</p></div> : null}

        {pageState.cards.length > 0 ? (
          <>
          <BinderCardGrid
            ariaLabel="Wishlistkaarten"
            items={pageState.cards.map((card) => ({
              id: card.cardCatalogId,
              imageSmall: card.imageSmall,
              label: `Open ${card.pokemon ?? 'wishlistkaart'}${card.number ? `, kaart ${card.number}` : ''}`,
            }))}
            getButtonRef={(id, element) => {
              if (element) cardButtonRefs.current.set(id, element);
              else cardButtonRefs.current.delete(id);
            }}
            onSelect={(id) => {
              const card = pageState.cards.find((pageCard) => pageCard.cardCatalogId === id);
              if (card) openDetail(card);
            }}
          />
          <nav className="collection-page-pagination" aria-label="Wishlistpaginatie onder">
            <button type="button" onClick={goToPreviousPage} disabled={isLoading || pageState.page <= 1}>Previous</button>
            <span>Pagina {pageState.page} van {totalPages}</span>
            <button type="button" onClick={goToNextPage} disabled={isLoading || pageState.page >= totalPages}>Next</button>
          </nav>
          </>
        ) : null}
      </section>

      {selectedCard ? (
        <CardDetailDialog
          card={selectedCard}
          ownership={ownership}
          mutation={detailMutation}
          capabilities={{
            canAdd: false,
            canPromoteWishlist: ownership.status === 'ready' && ownership.value.kind === 'snapshot' && ownership.value.value.byStatus.wishlist.length === 1 && ownership.value.value.byStatus.owned.length === 0 && ownership.value.value.byStatus.trade.length === 0 && ownership.value.value.byStatus.missing.length === 0,
            canRemoveWishlist: ownership.status === 'ready' && ownership.value.kind === 'snapshot' && ownership.value.value.byStatus.wishlist.length === 1,
            canIncrease: false,
            canDecrease: false,
          }}
          copy={createWishlistCardDetailProductCopy(ownership)}
          readOnly
          onClose={closeDetail}
          onRetryOwnership={() => {
            if (pageState.collectionId) loadSelectedOwnership(selectedCard, pageState.collectionId);
          }}
          onRemoveWishlist={() => void removeSelectedWishlistCard()}
          onPromoteWishlist={() => void promoteSelectedWishlistCard()}
          onRetryMutation={() => void (detailMutation.status === 'error' && detailMutation.operation === 'promote-wishlist' ? promoteSelectedWishlistCard() : removeSelectedWishlistCard())}
        />
      ) : null}
    </>
  );
}
