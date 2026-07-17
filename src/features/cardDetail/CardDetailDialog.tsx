import { useEffect, useMemo, useRef } from 'react';

import type {
  ConfirmedOwnership,
  CollectionOwnershipState,
  CollectionStatus,
} from '../collectionCards';
import { areCardDetailActionsBlocked, getCardDetailActionMode, getCardDetailWishlistAction } from './cardDetailMutationState';
import { getCardDetailMetadata, getCardDetailNavigationState, type CardDetailMetadataIcon } from './cardDetailGallery';

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

function AttributeIcon({ icon }: { icon: CardDetailMetadataIcon }) {
  const common = { className: 'card-detail-attribute-svg', viewBox: '0 0 24 24', 'aria-hidden': true } as const;
  if (icon === 'energy-psychic') return <svg {...common}><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="2.4" /><path d="M12 4v3M12 17v3M4 12h3M17 12h3M6.3 6.3l2.1 2.1M15.6 15.6l2.1 2.1M17.7 6.3l-2.1 2.1M8.4 15.6l-2.1 2.1" /></svg>;
  if (icon === 'energy-darkness') return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M15.8 5.2a7 7 0 1 0 3 10.4 6 6 0 1 1-3-10.4Z" /></svg>;
  if (icon === 'energy-fire') return <svg {...common}><path d="M13 3c1 4-2 5-2 8 0 1.4.9 2.2 2 2.2 2 0 3-2.2 2.6-4.2 2.6 2.3 4.4 5 3.2 7.8A7.2 7.2 0 0 1 5 14c0-3.6 2.2-6.1 5.3-8.8-.2 2.4.7 3.7 1.7 4.2C11.7 7 12 5 13 3Z" /></svg>;
  if (icon === 'energy-water') return <svg {...common}><path d="M12 3S6 10.1 6 15a6 6 0 0 0 12 0c0-4.9-6-12-6-12Z" /></svg>;
  if (icon === 'energy-grass') return <svg {...common}><path d="M20 4C10 4 5 8 5 14c0 3 2 5 5 5 6 0 10-5 10-15Z" /><path d="M5 20c2-5 6-8 12-12" /></svg>;
  if (icon === 'energy-lightning') return <svg {...common}><path d="m13 2-8 12h7l-1 8 8-12h-7l1-8Z" /></svg>;
  if (icon === 'energy-colorless') return <svg {...common}><path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z" /></svg>;
  if (icon === 'rarity-common') return <svg {...common}><circle cx="12" cy="12" r="5" /></svg>;
  if (icon === 'rarity-uncommon') return <svg {...common}><path d="m12 4 8 8-8 8-8-8 8-8Z" /></svg>;
  if (icon === 'rarity-rare') return <svg {...common}><path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z" /></svg>;
  if (icon === 'rarity-ultra') return <svg {...common}><path d="m8 4 1.8 3.7 4.2.6-3 2.9.7 4.1L8 13.4l-3.7 1.9.7-4.1-3-2.9 4.2-.6L8 4Zm9 7 1.2 2.4 2.8.4-2 2 .5 2.7-2.5-1.3-2.5 1.3.5-2.7-2-2 2.8-.4L17 11Z" /></svg>;
  if (icon === 'rarity-special') return <svg {...common}><path d="m6 3 1.2 2.5 2.8.4-2 2 .5 2.7L6 9.3l-2.5 1.3L4 7.9l-2-2 2.8-.4L6 3Zm12 0 1.2 2.5 2.8.4-2 2 .5 2.7L18 9.3l-2.5 1.3.5-2.7-2-2 2.8-.4L18 3Zm-6 9 1.2 2.5 2.8.4-2 2 .5 2.7-2.5-1.3-2.5 1.3.5-2.7-2-2 2.8-.4L12 12Z" /></svg>;
  if (icon === 'pokedex') return <svg {...common}><path d="M5 4h14M5 20h14M8 4v16M16 4v16" /><path d="M11 9h2a2 2 0 0 1 0 4h-2m0 0h2a2 2 0 0 1 0 4h-2" /></svg>;
  if (icon === 'genset') return <svg {...common}><path d="m4 8 8-4 8 4-8 4-8-4Zm0 4 8 4 8-4M4 16l8 4 8-4" /></svg>;
  if (icon === 'release-date') return <svg {...common}><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01" /></svg>;
  return <svg {...common}><path d="m14 5 5 5M4 20l4.2-1 9.7-9.7a2.1 2.1 0 0 0-3-3L5.2 16 4 20Z" /><path d="m13 7 4 4" /></svg>;
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
  const managementMessages = [copy.managementMessage, capabilities.unavailableReason]
    .filter((message): message is string => Boolean(message))
    .filter((message, index, messages) => messages.indexOf(message) === index);

  useEffect(() => {
    window.setTimeout(() => closeButtonRef.current?.focus(), 0);
  }, []);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
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
      >
        <header className="card-detail-header">
          {navigation && navigationState && navigation.total > 1 ? (
            <nav className="card-detail-navigation" aria-label="Kaartnavigatie">
              <button type="button" aria-label="Vorige kaart" onClick={navigation.onPrevious} disabled={!navigationState.canPrevious}>‹</button>
              <button type="button" aria-label="Volgende kaart" onClick={navigation.onNext} disabled={!navigationState.canNext}>›</button>
            </nav>
          ) : <span aria-hidden="true" />}
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
                    <span className={`card-detail-attribute-icon is-${item.icon}`}><AttributeIcon icon={item.icon} /></span>
                    <dt>{item.label}</dt>
                    <dd>{item.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            {copy.statusItems.length > 0 ? <ul className="card-detail-status-list" aria-label="Collectiestatussen">{copy.statusItems.map((item) => <li key={item.status}>{item.label}</li>)}</ul> : null}
            {ownership.status === 'error' && onRetryOwnership ? <button className="card-detail-retry-button" type="button" onClick={onRetryOwnership}>Collectiestatus opnieuw laden</button> : null}
            {mutation.status === 'error' && mutation.retryable && onRetryMutation ? (
              <button className="card-detail-retry-button" type="button" onClick={onRetryMutation} disabled={isMutating}>
                Opnieuw proberen
              </button>
            ) : null}
            {managementMessages.map((message) => <span key={message} className="card-detail-management-message">{message}</span>)}
            {feedbackMessage ? <span className={`card-detail-feedback-message${feedbackRole === 'alert' ? ' is-error' : ' is-success'}`} role={feedbackRole}>{feedbackMessage}</span> : null}
          </div>
        </div>
      </section>
    </div>
  );
}
