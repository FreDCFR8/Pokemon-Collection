import { useEffect, useMemo, useRef } from 'react';

import type {
  CollectionOwnershipState,
  CollectionStatus,
} from '../collectionCards';

export type CardDetailMutationOperation = 'add' | 'increase' | 'decrease' | 'delete';

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
  set: { setCode: string | null; name: string | null };
  rarity: string | null;
  images: { small: string | null; large: string | null };
};

export type CardDetailCapabilities = {
  canAdd: boolean;
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
  onClose(): void;
  onRetryOwnership?(): void;
  onAdd?(): void;
  onIncrease?(): void;
  onDecrease?(): void;
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
  onClose,
  onRetryOwnership,
  onAdd,
  onIncrease,
  onDecrease,
}: CardDetailDialogProps) {
  const dialogRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const detailImageUrl = card.images.large ?? card.images.small;
  const isMutating = mutation.status === 'pending';
  const ownershipPresentation = useMemo(() => {
    if (isMutating) return { label: 'Bijwerken…', className: 'is-pending' };
    return getOwnershipLabel(ownership, copy);
  }, [copy, isMutating, ownership]);
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
          <button ref={closeButtonRef} type="button" aria-label="Kaartdetails sluiten" onClick={onClose}>×</button>
        </header>
        <div className="card-detail-content">
          <div className="card-detail-image">
            {detailImageUrl ? <img src={detailImageUrl} alt={`${card.name} kaart ${card.number ?? ''}`.trim()} width="240" height="336" decoding="async" /> : <span aria-label="Geen afbeelding beschikbaar" />}
          </div>
          <div className="card-detail-body">
            <h4 id="card-detail-title">{card.name}</h4>
            <p className="card-detail-subtitle">
              {card.set.name ?? 'Onbekende set'}{card.number ? ` · #${card.number}` : ''}
            </p>
            <span className="card-detail-quantity-control" role="group" aria-label="Aantal in collectie">
              <button type="button" aria-label="Eén exemplaar verwijderen" disabled={!capabilities.canDecrease || isMutating} onClick={onDecrease}>−</button>
              <span id="card-detail-status" className={`card-detail-quantity-status ${ownershipPresentation.className}`} aria-live="polite">
                {ownershipPresentation.className === 'is-present' ? <span className="card-detail-quantity-status-mark" aria-hidden="true">✓</span> : null}
                {ownershipPresentation.label}
              </span>
              <button type="button" aria-label={capabilities.canAdd ? 'Kaart aan collectie toevoegen' : 'Eén exemplaar toevoegen'} disabled={(!capabilities.canAdd && !capabilities.canIncrease) || isMutating} onClick={() => capabilities.canAdd ? onAdd?.() : onIncrease?.()}>+</button>
            </span>
            {copy.statusItems.length > 0 ? <ul className="card-detail-status-list" aria-label="Collectiestatussen">{copy.statusItems.map((item) => <li key={item.status}>{item.label}</li>)}</ul> : null}
            {ownership.status === 'error' && onRetryOwnership ? <button className="card-detail-retry-button" type="button" onClick={onRetryOwnership}>Collectiestatus opnieuw laden</button> : null}
            {managementMessages.map((message) => <span key={message} className="card-detail-management-message">{message}</span>)}
            {feedbackMessage ? <span className={`card-detail-feedback-message${feedbackRole === 'alert' ? ' is-error' : ' is-success'}`} role={feedbackRole}>{feedbackMessage}</span> : null}
          </div>
        </div>
      </section>
    </div>
  );
}
