import { useEffect, useMemo, useRef, type TouchEvent } from 'react';

import type {
  ConfirmedOwnership,
  CollectionOwnershipState,
  CollectionStatus,
} from '../collectionCards';
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
    onPrevious(): void;
    onNext(): void;
  };
};

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const SWIPE_THRESHOLD_PX = 55;
const CARD_DETAIL_SCROLL_LOCK_ATTRIBUTE = 'data-card-detail-scroll-lock';

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true',
  );
}

function getOwnershipLabel(ownership: CollectionOwnershipState, copy: CardDetailProductCopy): { label: string; className: string } {
  if (ownership.status === 'loading') return { label: 'Status laden…', className: 'is-pending' };
  if (ownership.status === 'error') return { label: 'Status onbekend', className: 'is-unknown' };
  if (ownership.status !== 'ready') return { label: 'Status onbekend', className: 'is-unknown' };
  if (ownership.value.kind === 'absent') return { label: 'Niet in collectie', className: 'is-absent' };
  if (ownership.value.kind === 'conflict') return { label: 'Status onbekend', className: 'is-unknown' };

  if (ownership.value.value.byStatus.wishlist.length > 0 &&
      ownership.value.value.byStatus.owned.length === 0 &&
      ownership.value.value.byStatus.trade.length === 0) {
    return { label: 'Wishlist', className: 'is-absent' };
  }

  const manageable = ownership.value.value.manageableOwnedNearMintRecord;
  if (manageable) {
    return {
      label: manageable.quantity === 1 ? 'In collectie' : `${manageable.quantity} in collectie`,
      className: 'is-present',
    };
  }

  return {
    label: copy.physicalPresenceLabel ?? (ownership.value.value.physicalPresence === 'present' ? 'In collectie' : 'Niet in collectie'),
    className: ownership.value.value.physicalPresence === 'present' ? 'is-present' : 'is-absent',
  };
}

export function CardDetailDialog({
  card,
  ownership,
  mutation,
  capabilities,
  copy,
  readOnly = false,
  onClose,
  onRetryOwnership,
  onAdd,
  onAddWishlist,
  onRemoveWishlist,
  onPromoteWishlist,
  onRetryMutation,
  onIncrease,
  onDecrease,
  navigation,
}: CardDetailDialogProps) {
  const dialogRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const detailImageUrl = card.images.large ?? card.images.small;
  const metadata = useMemo(() => getCardDetailMetadata(card), [card]);
  const navigationState = navigation
    ? getCardDetailNavigationState(navigation.currentIndex, navigation.total)
    : null;
  const areActionsBlocked = areCardDetailActionsBlocked(mutation);
  const isMutating = mutation.status === 'pending';
  const ownershipPresentation = useMemo(() => {
    if (isMutating) return { label: 'Bijwerken…', className: 'is-pending' };
    return getOwnershipLabel(ownership, copy);
  }, [copy, mutation.status, ownership]);
  const confirmedOwnership: ConfirmedOwnership | undefined = ownership.status === 'ready' ? ownership.value : undefined;
  const actionMode = getCardDetailActionMode({ readOnly, ownership: confirmedOwnership });
  const showQuantityControl = actionMode === 'quantity';
  const showCollectionAddAction = actionMode === 'add';
  const wishlistAction = getCardDetailWishlistAction(capabilities);
  const feedbackRole = mutation.status === 'error' || mutation.status === 'conflict' ? 'alert' : 'status';
  const feedbackMessage = mutation.status === 'success' || mutation.status === 'error' || mutation.status === 'conflict'
    ? mutation.message
    : undefined;

  useEffect(() => {
    window.setTimeout(() => closeButtonRef.current?.focus(), 0);
  }, []);

  useEffect(() => {
    const scrollY = window.scrollY;
    const bodyStyle = document.body.style;
    const documentStyle = document.documentElement.style;
    const previousBodyStyles = {
      overflow: bodyStyle.overflow,
      position: bodyStyle.position,
      top: bodyStyle.top,
      width: bodyStyle.width,
    };
    const previousDocumentOverflow = documentStyle.overflow;
    let restored = false;

    function restoreScrollLock({ restorePosition = true }: { restorePosition?: boolean } = {}) {
      if (restored) return;
      restored = true;

      bodyStyle.overflow = previousBodyStyles.overflow;
      bodyStyle.position = previousBodyStyles.position;
      bodyStyle.top = previousBodyStyles.top;
      bodyStyle.width = previousBodyStyles.width;
      documentStyle.overflow = previousDocumentOverflow;
      document.body.removeAttribute(CARD_DETAIL_SCROLL_LOCK_ATTRIBUTE);

      if (restorePosition) window.scrollTo(0, scrollY);
    }

    function handlePageHide() {
      restoreScrollLock({ restorePosition: false });
    }

    function handlePageShow() {
      if (!document.querySelector('.card-detail-dialog')) {
        restoreScrollLock();
      }
    }

    bodyStyle.overflow = 'hidden';
    bodyStyle.position = 'fixed';
    bodyStyle.top = `-${scrollY}px`;
    bodyStyle.width = '100%';
    documentStyle.overflow = 'hidden';
    document.body.setAttribute(CARD_DETAIL_SCROLL_LOCK_ATTRIBUTE, 'true');

    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('pageshow', handlePageShow);

    return () => {
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('pageshow', handlePageShow);
      restoreScrollLock();
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusableElements = getFocusableElements(dialogRef.current);
      if (focusableElements.length === 0) {
        event.preventDefault();
        return;
      }
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  function handleTouchStart(event: TouchEvent<HTMLElement>) {
    const touch = event.touches[0];
    touchStartRef.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
  }

  function handleTouchEnd(event: TouchEvent<HTMLElement>) {
    const start = touchStartRef.current;
    const touch = event.changedTouches[0];
    touchStartRef.current = null;
    if (!start || !touch || !navigation || !navigationState) return;

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaX) < SWIPE_THRESHOLD_PX || Math.abs(deltaX) <= Math.abs(deltaY) * 1.25) return;

    if (deltaX < 0 && navigationState.canNext) navigation.onNext();
    if (deltaX > 0 && navigationState.canPrevious) navigation.onPrevious();
  }

  return (
    <div
      className="card-detail-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        className="card-detail-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="card-detail-title"
        aria-describedby="card-detail-status"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <header className="card-detail-header">
          <button ref={closeButtonRef} type="button" aria-label="Kaartdetails sluiten" onClick={onClose}>×</button>
        </header>
        <div className="card-detail-content">
          <div className="card-detail-image">
            {detailImageUrl ? <img src={detailImageUrl} alt={`${card.name} kaart ${card.number ?? ''}`.trim()} width="600" height="840" decoding="async" /> : <span aria-label="Geen afbeelding beschikbaar" />}
          </div>
          <div className="card-detail-body">
            <p className="card-detail-set">
              <span>Pokémon</span>
              {card.set.series ? <><span aria-hidden="true">|</span><span>{card.set.series}</span></> : null}
              {card.set.name ? <><span aria-hidden="true">|</span><strong>{card.set.name}</strong></> : null}
            </p>
            <h1 id="card-detail-title">{card.name}</h1>
            <p className="card-detail-subtitle">
              {card.set.name ?? 'Onbekende set'}{card.number ? ` · #${card.number}` : ''}
            </p>
            <div className="card-detail-action-row">
              {showCollectionAddAction || capabilities.canPromoteWishlist ? (
                <button className="card-detail-primary-action" type="button" disabled={areActionsBlocked} onClick={showCollectionAddAction ? onAdd : onPromoteWishlist}>
                  Aan collectie toevoegen
                </button>
              ) : showQuantityControl ? (
                <span className="card-detail-quantity-control" role="group" aria-label="Aantal in collectie">
                  <button type="button" aria-label="Eén exemplaar verwijderen" disabled={!capabilities.canDecrease || areActionsBlocked} onClick={onDecrease}>−</button>
                  <span id="card-detail-status" className={`card-detail-quantity-status ${ownershipPresentation.className}`} aria-live="polite">
                    {ownershipPresentation.className === 'is-present' ? <span className="card-detail-quantity-status-mark" aria-hidden="true">✓</span> : null}
                    {ownershipPresentation.label}
                  </span>
                  <button type="button" aria-label={capabilities.canAdd ? 'Kaart aan collectie toevoegen' : 'Eén exemplaar toevoegen'} disabled={(!capabilities.canAdd && !capabilities.canIncrease) || areActionsBlocked} onClick={() => capabilities.canAdd ? onAdd?.() : onIncrease?.()}>+</button>
                </span>
              ) : (
                <span id="card-detail-status" className={`card-detail-quantity-status card-detail-read-only-status ${ownershipPresentation.className}`} aria-live="polite">
                  {ownershipPresentation.className === 'is-present' ? <span className="card-detail-quantity-status-mark" aria-hidden="true">✓</span> : null}
                  {ownershipPresentation.label}
                </span>
              )}
              {wishlistAction ? (
                <button className="card-detail-wishlist-button" type="button" disabled={areActionsBlocked} onClick={wishlistAction === 'add' ? onAddWishlist : onRemoveWishlist}>
                  {wishlistAction === 'add' ? 'Aan wishlist toevoegen' : 'Van wishlist verwijderen'}
                </button>
              ) : null}
            </div>
            <h2 className="card-detail-attributes-title">Attributes</h2>
            {metadata.length > 0 ? (
              <dl className="card-detail-attributes" aria-label="Kaartattributen">
                {metadata.map((item) => (
                  <div className="card-detail-attribute" key={item.label}>
                    <span className="card-detail-attribute-icons">
                      {item.icons.map((icon, index) => (
                        <span className={`card-detail-attribute-icon is-${icon}`} key={`${icon}-${index}`}>
                          <CardDetailAttributeIcon icon={icon} />
                        </span>
                      ))}
                    </span>
                    <div>
                      <dt>{item.label}</dt>
                      <dd>{item.value}</dd>
                    </div>
                  </div>
                ))}
              </dl>
            ) : null}
            {copy.managementMessage ? <p className="card-detail-management-message">{copy.managementMessage}</p> : null}
            {ownership.status === 'error' && onRetryOwnership ? <button type="button" onClick={onRetryOwnership}>Status opnieuw laden</button> : null}
            {feedbackMessage ? <p role={feedbackRole}>{feedbackMessage}</p> : null}
            {(mutation.status === 'error' || mutation.status === 'conflict') && onRetryMutation ? <button type="button" onClick={onRetryMutation}>Opnieuw proberen</button> : null}
          </div>
        </div>
      </section>
    </div>
  );
}
