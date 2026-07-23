import { useEffect, useMemo, useRef, useState, type CSSProperties, type TouchEvent } from 'react';

import type { ConfirmedOwnership, CollectionOwnershipState, CollectionStatus } from '../collectionCards';
import { CardDetailAttributeIcon } from './CardDetailAttributeIcon';
import { areCardDetailActionsBlocked, getCardDetailActionMode, getCardDetailWishlistAction } from './cardDetailMutationState';
import { getCardDetailMetadata, getCardDetailNavigationState } from './cardDetailGallery';

export type CardDetailMutationOperation = 'add' | 'add-wishlist' | 'remove-wishlist' | 'promote-wishlist' | 'increase' | 'decrease' | 'delete';

export type CardDetailMutationState =
  | { status: 'idle' }
  | { status: 'pending'; operation: CardDetailMutationOperation }
  | { status: 'success'; message?: string }
  | { status: 'error'; operation?: CardDetailMutationOperation; retryable: boolean; message: string }
  | { status: 'conflict'; operation?: CardDetailMutationOperation; refreshStatus: 'pending' | 'ready' | 'error'; message: string };

export type CardDetailCard = {
  cardCatalogId: string;
  name: string;
  number: string | null;
  set: { setCode: string | null; name: string | null; series?: string | null; releaseDate?: string | null };
  rarity: string | null;
  energyType?: string | null;
  details?: import('./cardDetails').CardDetailDetails | null;
  images: { small: string | null; large: string | null };
};

export type CardDetailCapabilities = {
  canAdd: boolean;
  canAddWishlist?: boolean;
  canRemoveWishlist?: boolean;
  canPromoteWishlist?: boolean;
  canIncrease: boolean;
  canDecrease: boolean;
  unavailableReason?: string;
};

export type CardDetailProductCopy = {
  statusItems: Array<{ status: CollectionStatus; label: string }>;
  physicalPresenceLabel?: string;
  managementMessage?: string;
};

export type CardDetailDialogProps = {
  card: CardDetailCard;
  ownership: CollectionOwnershipState;
  mutation: CardDetailMutationState;
  capabilities: CardDetailCapabilities;
  copy: CardDetailProductCopy;
  readOnly?: boolean;
  onClose(): void;
  onRetryOwnership?(): void;
  onAdd?(): void;
  onAddWishlist?(): void;
  onRemoveWishlist?(): void;
  onPromoteWishlist?(): void;
  onRetryMutation?(): void;
  onIncrease?(): void;
  onDecrease?(): void;
  navigation?: {
    currentIndex: number;
    total: number;
    previousImageUrl?: string | null;
    nextImageUrl?: string | null;
    onPrevious(): void;
    onNext(): void;
  };
};

const FOCUSABLE_SELECTOR = ['a[href]', 'button:not([disabled])', 'input:not([disabled])', 'select:not([disabled])', 'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])'].join(',');
const SWIPE_THRESHOLD_PX = 55;
const SWIPE_MAX_OFFSET_PX = 180;

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true',
  );
}

function getOwnershipLabel(ownership: CollectionOwnershipState, copy: CardDetailProductCopy): { label: string; className: string } {
  if (ownership.status === 'loading') return { label: 'Status laden…', className: 'is-pending' };
  if (ownership.status === 'error' || ownership.status !== 'ready' || ownership.value.kind === 'conflict') return { label: 'Status onbekend', className: 'is-unknown' };
  if (ownership.value.kind === 'absent') return { label: 'Niet in collectie', className: 'is-absent' };
  if (ownership.value.value.byStatus.wishlist.length > 0 && ownership.value.value.byStatus.owned.length === 0 && ownership.value.value.byStatus.trade.length === 0) {
    return { label: 'Wishlist', className: 'is-absent' };
  }
  const manageable = ownership.value.value.manageableOwnedNearMintRecord;
  if (manageable) return { label: manageable.quantity === 1 ? 'In collectie' : `${manageable.quantity} in collectie`, className: 'is-present' };
  return {
    label: copy.physicalPresenceLabel ?? (ownership.value.value.physicalPresence === 'present' ? 'In collectie' : 'Niet in collectie'),
    className: ownership.value.value.physicalPresence === 'present' ? 'is-present' : 'is-absent',
  };
}

export function CardDetailDialog({
  card, ownership, mutation, capabilities, copy, readOnly = false, onClose, onRetryOwnership, onAdd,
  onAddWishlist, onRemoveWishlist, onPromoteWishlist, onRetryMutation, onIncrease, onDecrease, navigation,
}: CardDetailDialogProps) {
  const dialogRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const detailImageUrl = card.images.large ?? card.images.small;
  const metadata = useMemo(() => getCardDetailMetadata(card), [card]);
  const navigationState = navigation ? getCardDetailNavigationState(navigation.currentIndex, navigation.total) : null;
  const areActionsBlocked = areCardDetailActionsBlocked(mutation);
  const isMutating = mutation.status === 'pending';
  const ownershipPresentation = useMemo(() => isMutating ? { label: 'Bijwerken…', className: 'is-pending' } : getOwnershipLabel(ownership, copy), [copy, isMutating, ownership]);
  const confirmedOwnership: ConfirmedOwnership | undefined = ownership.status === 'ready' ? ownership.value : undefined;
  const actionMode = getCardDetailActionMode({ readOnly, ownership: confirmedOwnership });
  const showQuantityControl = actionMode === 'quantity';
  const showCollectionAddAction = actionMode === 'add';
  const wishlistAction = getCardDetailWishlistAction(capabilities);
  const feedbackRole = mutation.status === 'error' || mutation.status === 'conflict' ? 'alert' : 'status';
  const feedbackMessage = mutation.status === 'success' || mutation.status === 'error' || mutation.status === 'conflict' ? mutation.message : undefined;

  useEffect(() => { window.setTimeout(() => closeButtonRef.current?.focus(), 0); }, []);

  useEffect(() => {
    setSwipeOffset(0);
    setIsSwiping(false);
  }, [card.cardCatalogId]);

  useEffect(() => {
    const urls = [navigation?.previousImageUrl, navigation?.nextImageUrl].filter((url): url is string => Boolean(url));
    const images = urls.map((url) => { const image = new Image(); image.decoding = 'async'; image.src = url; return image; });
    return () => { images.forEach((image) => { image.src = ''; }); };
  }, [navigation?.nextImageUrl, navigation?.previousImageUrl]);

  useEffect(() => {
    const scrollY = window.scrollY;
    const bodyStyle = document.body.style;
    const previousBodyStyles = { overflow: bodyStyle.overflow, position: bodyStyle.position, top: bodyStyle.top, width: bodyStyle.width };
    const previousDocumentOverflow = document.documentElement.style.overflow;
    bodyStyle.overflow = 'hidden'; bodyStyle.position = 'fixed'; bodyStyle.top = `-${scrollY}px`; bodyStyle.width = '100%';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      bodyStyle.overflow = previousBodyStyles.overflow; bodyStyle.position = previousBodyStyles.position;
      bodyStyle.top = previousBodyStyles.top; bodyStyle.width = previousBodyStyles.width;
      document.documentElement.style.overflow = previousDocumentOverflow; window.scrollTo(0, scrollY);
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return; }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusableElements = getFocusableElements(dialogRef.current);
      if (focusableElements.length === 0) { event.preventDefault(); return; }
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      if (event.shiftKey && document.activeElement === firstElement) { event.preventDefault(); lastElement.focus(); }
      else if (!event.shiftKey && document.activeElement === lastElement) { event.preventDefault(); firstElement.focus(); }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  function handleTouchStart(event: TouchEvent<HTMLElement>) {
    const touch = event.touches[0];
    touchStartRef.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
    setIsSwiping(false);
  }

  function handleTouchMove(event: TouchEvent<HTMLElement>) {
    const start = touchStartRef.current;
    const touch = event.touches[0];
    if (!start || !touch || !navigation || !navigationState) return;
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (!isSwiping && Math.abs(deltaX) <= Math.abs(deltaY) * 1.15) return;
    const canMove = deltaX < 0 ? navigationState.canNext : navigationState.canPrevious;
    setIsSwiping(true);
    setSwipeOffset(Math.max(-SWIPE_MAX_OFFSET_PX, Math.min(SWIPE_MAX_OFFSET_PX, canMove ? deltaX : deltaX * 0.22)));
  }

  function handleTouchEnd(event: TouchEvent<HTMLElement>) {
    const start = touchStartRef.current;
    const touch = event.changedTouches[0];
    touchStartRef.current = null;
    if (!start || !touch || !navigation || !navigationState) { setSwipeOffset(0); setIsSwiping(false); return; }
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    const isHorizontalSwipe = Math.abs(deltaX) >= SWIPE_THRESHOLD_PX && Math.abs(deltaX) > Math.abs(deltaY) * 1.25;
    setSwipeOffset(0); setIsSwiping(false);
    if (!isHorizontalSwipe) return;
    if (deltaX < 0 && navigationState.canNext) navigation.onNext();
    if (deltaX > 0 && navigationState.canPrevious) navigation.onPrevious();
  }

  const swipeStyle = { '--card-detail-swipe-x': `${swipeOffset}px` } as CSSProperties;

  return (
    <div className="card-detail-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={dialogRef} className="card-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="card-detail-title" aria-describedby="card-detail-status" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd} onTouchCancel={() => { touchStartRef.current = null; setSwipeOffset(0); setIsSwiping(false); }}>
        <header className="card-detail-header"><button ref={closeButtonRef} type="button" aria-label="Kaartdetails sluiten" onClick={onClose}>×</button></header>
        <div className={`card-detail-content card-detail-swipe-surface${isSwiping ? ' is-swiping' : ''}`} style={swipeStyle}>
          <div className="card-detail-image">{detailImageUrl ? <img src={detailImageUrl} alt={`${card.name} kaart ${card.number ?? ''}`.trim()} width="600" height="840" decoding="async" /> : <span aria-label="Geen afbeelding beschikbaar" />}</div>
          <div className="card-detail-body">
            <p className="card-detail-set"><span>Pokémon</span>{card.set.series ? <><span aria-hidden="true">|</span><span>{card.set.series}</span></> : null}{card.set.name ? <><span aria-hidden="true">|</span><strong>{card.set.name}</strong></> : null}</p>
            <h1 id="card-detail-title">{card.name}</h1>
            <p className="card-detail-subtitle">{card.set.name ?? 'Onbekende set'}{card.number ? ` · #${card.number}` : ''}</p>
            <div className="card-detail-action-row">
              {showCollectionAddAction || capabilities.canPromoteWishlist ? <button className="card-detail-primary-action" type="button" disabled={areActionsBlocked} onClick={showCollectionAddAction ? onAdd : onPromoteWishlist}>Aan collectie toevoegen</button>
                : showQuantityControl ? <span className="card-detail-quantity-control" role="group" aria-label="Aantal in collectie"><button type="button" aria-label="Eén exemplaar verwijderen" disabled={!capabilities.canDecrease || areActionsBlocked} onClick={onDecrease}>−</button><span id="card-detail-status" className={`card-detail-quantity-status ${ownershipPresentation.className}`} aria-live="polite">{ownershipPresentation.className === 'is-present' ? <span className="card-detail-quantity-status-mark" aria-hidden="true">✓</span> : null}{ownershipPresentation.label}</span><button type="button" aria-label={capabilities.canAdd ? 'Kaart aan collectie toevoegen' : 'Eén exemplaar toevoegen'} disabled={(!capabilities.canAdd && !capabilities.canIncrease) || areActionsBlocked} onClick={() => capabilities.canAdd ? onAdd?.() : onIncrease?.()}>+</button></span>
                  : <span id="card-detail-status" className={`card-detail-quantity-status card-detail-read-only-status ${ownershipPresentation.className}`} aria-live="polite">{ownershipPresentation.className === 'is-present' ? <span className="card-detail-quantity-status-mark" aria-hidden="true">✓</span> : null}{ownershipPresentation.label}</span>}
              {wishlistAction ? <button className="card-detail-wishlist-button" type="button" disabled={areActionsBlocked} onClick={wishlistAction === 'add' ? onAddWishlist : onRemoveWishlist}>{wishlistAction === 'add' ? 'Aan wishlist toevoegen' : 'Van wishlist verwijderen'}</button> : null}
            </div>
            <h2 className="card-detail-attributes-title">Attributes</h2>
            {metadata.length > 0 ? <dl className="card-detail-attributes" aria-label="Kaartattributen">{metadata.map((item) => <div className="card-detail-attribute" key={item.label}><span className="card-detail-attribute-icons">{item.icons.map((icon, index) => <span className={`card-detail-attribute-icon is-${icon}`} key={`${icon}-${index}`}><CardDetailAttributeIcon icon={icon} /></span>)}</span><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl> : null}
            {ownership.status === 'error' && onRetryOwnership ? <button className="card-detail-retry-button" type="button" onClick={onRetryOwnership}>Collectiestatus opnieuw laden</button> : null}
            {mutation.status === 'error' && mutation.retryable && onRetryMutation ? <button className="card-detail-retry-button" type="button" onClick={onRetryMutation} disabled={isMutating}>Opnieuw proberen</button> : null}
            {feedbackMessage ? <span className={`card-detail-feedback-message${feedbackRole === 'alert' ? ' is-error' : ' is-success'}`} role={feedbackRole}>{feedbackMessage}</span> : null}
          </div>
        </div>
      </section>
    </div>
  );
}
