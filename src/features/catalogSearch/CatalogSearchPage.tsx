import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { BinderCardGrid } from '../../components/BinderCardGrid';
import { CardDetailDialog, type CardDetailCard, type CardDetailMutationState } from '../cardDetail';
import { getCollectionCardOwnershipForCatalogCards, type CollectionOwnershipState, type ConfirmedOwnership } from '../collectionCards';
import { checkCollectionReadiness } from '../collections';
import { createCardDetailOwnershipPresentation } from '../cardDetail/cardDetailOwnershipPresentation';
import { searchCatalog } from './catalogSearchService';
import { isCatalogSearchTermValid, normalizeCatalogSearchTerm } from './catalogSearchHelpers';
import { toCatalogSearchCardDetailCard } from './catalogSearchCardDetailAdapter';
import {
  getSafeCatalogSearchErrorMessage,
  shouldApplyCatalogSearchContext,
  shouldApplyCatalogSearchDetailContext,
  toCatalogSearchDetailOwnershipState,
  type CatalogSearchDetailContext,
  type CatalogSearchRequestContext,
} from './catalogSearchStateHelpers';
import { CATALOG_SEARCH_PAGE_SIZE, type CatalogSearchCard, type CatalogSearchResult } from './catalogSearchTypes';

type SearchStatus = 'idle' | 'invalid' | 'loading' | 'ready' | 'empty' | 'error';
type OwnershipStatus = 'idle' | 'loading' | 'ready' | 'error';

function confirmedPresence(value: ConfirmedOwnership | undefined): boolean {
  return value?.kind === 'snapshot' && value.value.physicalPresence === 'present';
}

export function CatalogSearchPage() {
  const [input, setInput] = useState('');
  const [activeTerm, setActiveTerm] = useState('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<CatalogSearchResult | null>(null);
  const [status, setStatus] = useState<SearchStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [ownershipById, setOwnershipById] = useState<Map<string, ConfirmedOwnership>>(new Map());
  const [ownershipStatus, setOwnershipStatus] = useState<OwnershipStatus>('idle');
  const [selected, setSelected] = useState<CardDetailCard | null>(null);
  const [detailOwnership, setDetailOwnership] = useState<CollectionOwnershipState>({ status: 'idle' });
  const searchRequestIdRef = useRef(0);
  const activeSearchContextRef = useRef<CatalogSearchRequestContext | null>(null);
  const detailRequestIdRef = useRef(0);
  const activeDetailContextRef = useRef<CatalogSearchDetailContext | null>(null);
  const cardButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const currentCards = result?.cards ?? [];
  const totalPages = Math.max(1, Math.ceil((result?.totalCount ?? 0) / CATALOG_SEARCH_PAGE_SIZE));
  const selectedIndex = selected ? currentCards.findIndex((card) => card.id === selected.cardCatalogId) : -1;
  const mutation: CardDetailMutationState = { status: 'idle' };
  const copy = useMemo(
    () => createCardDetailOwnershipPresentation({ ownership: detailOwnership.status === 'ready' ? detailOwnership.value : undefined }),
    [detailOwnership],
  );

  const invalidateDetailContext = () => {
    detailRequestIdRef.current += 1;
    activeDetailContextRef.current = null;
    setSelected(null);
    setDetailOwnership({ status: 'idle' });
  };

  const invalidateSearchContext = () => {
    searchRequestIdRef.current += 1;
    activeSearchContextRef.current = null;
    invalidateDetailContext();
  };

  const updateDetailFromOwnership = (cardCatalogId: string, ownership: Map<string, ConfirmedOwnership>, nextOwnershipStatus: OwnershipStatus) => {
    if (activeDetailContextRef.current?.cardCatalogId !== cardCatalogId) return;
    setDetailOwnership(toCatalogSearchDetailOwnershipState(ownership.get(cardCatalogId), nextOwnershipStatus === 'loading' ? 'loading' : nextOwnershipStatus === 'ready' ? 'ready' : 'error'));
  };

  const loadOwnershipForResult = async (nextResult: CatalogSearchResult, searchContext: CatalogSearchRequestContext) => {
    setOwnershipStatus('loading');

    try {
      const readiness = await checkCollectionReadiness();
      const collectionId = readiness.mainCollection?.id;
      if (!collectionId) throw new Error('collection-unavailable');

      const ownership = await getCollectionCardOwnershipForCatalogCards({
        collectionId,
        cardCatalogIds: nextResult.cards.map((card) => card.id),
      });

      if (!shouldApplyCatalogSearchContext(activeSearchContextRef.current, searchContext)) return;
      setOwnershipById(ownership);
      setOwnershipStatus('ready');
      const detail = activeDetailContextRef.current;
      if (detail?.searchRequestId === searchContext.requestId) updateDetailFromOwnership(detail.cardCatalogId, ownership, 'ready');
    } catch {
      if (!shouldApplyCatalogSearchContext(activeSearchContextRef.current, searchContext)) return;
      setOwnershipStatus('error');
      const detail = activeDetailContextRef.current;
      if (detail?.searchRequestId === searchContext.requestId) updateDetailFromOwnership(detail.cardCatalogId, new Map(), 'error');
    }
  };

  const loadSearchResults = (term: string, nextPage: number) => {
    const normalizedTerm = normalizeCatalogSearchTerm(term);
    if (!isCatalogSearchTermValid(normalizedTerm)) {
      invalidateSearchContext();
      setInput(term);
      setActiveTerm('');
      setPage(1);
      setResult(null);
      setStatus('invalid');
      setErrorMessage(null);
      setOwnershipById(new Map());
      setOwnershipStatus('idle');
      return;
    }

    const searchContext: CatalogSearchRequestContext = { requestId: ++searchRequestIdRef.current, term: normalizedTerm, page: nextPage };
    activeSearchContextRef.current = searchContext;
    invalidateDetailContext();
    setActiveTerm(normalizedTerm);
    setPage(nextPage);
    setStatus('loading');
    setErrorMessage(null);
    setResult(null);
    setOwnershipById(new Map());
    setOwnershipStatus('loading');

    searchCatalog(normalizedTerm, nextPage).then((nextResult) => {
      if (!shouldApplyCatalogSearchContext(activeSearchContextRef.current, searchContext)) return;
      setResult(nextResult);
      setStatus(nextResult.cards.length > 0 ? 'ready' : 'empty');
      void loadOwnershipForResult(nextResult, searchContext);
    }).catch(() => {
      if (!shouldApplyCatalogSearchContext(activeSearchContextRef.current, searchContext)) return;
      setStatus('error');
      setErrorMessage(getSafeCatalogSearchErrorMessage());
      setOwnershipStatus('error');
    });
  };

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    loadSearchResults(input, 1);
  };

  const clearSearch = () => {
    invalidateSearchContext();
    setInput('');
    setActiveTerm('');
    setPage(1);
    setResult(null);
    setStatus('idle');
    setErrorMessage(null);
    setOwnershipById(new Map());
    setOwnershipStatus('idle');
  };

  const openCard = (card: CatalogSearchCard) => {
    const detailContext: CatalogSearchDetailContext = {
      requestId: ++detailRequestIdRef.current,
      searchRequestId: activeSearchContextRef.current?.requestId ?? 0,
      cardCatalogId: card.id,
    };
    activeDetailContextRef.current = detailContext;
    const detailCard = toCatalogSearchCardDetailCard(card);
    setSelected(detailCard);
    setDetailOwnership(toCatalogSearchDetailOwnershipState(ownershipById.get(card.id), ownershipStatus === 'loading' ? 'loading' : ownershipStatus === 'ready' ? 'ready' : 'error'));
  };

  const closeCard = () => {
    const closingCardId = selected?.cardCatalogId;
    invalidateDetailContext();
    window.setTimeout(() => {
      if (closingCardId) cardButtonRefs.current.get(closingCardId)?.focus();
    }, 0);
  };

  const navigateCard = (direction: -1 | 1) => {
    if (selectedIndex < 0) return;
    const nextCard = currentCards[selectedIndex + direction];
    if (nextCard) openCard(nextCard);
  };

  const retrySelectedOwnership = async () => {
    const selectedContext = activeDetailContextRef.current;
    const selectedCardId = selected?.cardCatalogId;
    const searchContext = activeSearchContextRef.current;
    if (!selectedContext || !selectedCardId || !searchContext || selectedContext.searchRequestId !== searchContext.requestId) return;

    const detailContext: CatalogSearchDetailContext = { ...selectedContext, requestId: ++detailRequestIdRef.current };
    activeDetailContextRef.current = detailContext;
    setDetailOwnership({ status: 'loading' });

    try {
      const readiness = await checkCollectionReadiness();
      const collectionId = readiness.mainCollection?.id;
      if (!collectionId) throw new Error('collection-unavailable');
      const ownership = await getCollectionCardOwnershipForCatalogCards({ collectionId, cardCatalogIds: [selectedCardId] });
      if (!shouldApplyCatalogSearchDetailContext(activeDetailContextRef.current, detailContext)) return;
      const nextOwnership = ownership.get(selectedCardId);
      setOwnershipById((current) => {
        const next = new Map(current);
        if (nextOwnership) next.set(selectedCardId, nextOwnership);
        return next;
      });
      setDetailOwnership(nextOwnership ? { status: 'ready', value: nextOwnership } : { status: 'error', retryable: true });
    } catch {
      if (shouldApplyCatalogSearchDetailContext(activeDetailContextRef.current, detailContext)) setDetailOwnership({ status: 'error', retryable: true });
    }
  };

  useEffect(() => () => {
    searchRequestIdRef.current += 1;
    detailRequestIdRef.current += 1;
    activeSearchContextRef.current = null;
    activeDetailContextRef.current = null;
  }, []);

  const isLoading = status === 'loading';

  return <>
    <section className="collection-page catalog-search-page" aria-labelledby="catalog-search-title" inert={selected ? true : undefined}>
      <div className="collection-page-header"><h2 id="catalog-search-title">Zoeken</h2></div>
      <form className="collection-page-search" onSubmit={submitSearch}>
        <div className="collection-page-search-control">
          <input type="search" value={input} maxLength={80} aria-label="Catalogus zoeken" placeholder="Zoek op Pokémon, set of nummer" onChange={(event) => setInput(event.target.value)} />
          {input ? <button type="button" aria-label="Zoekterm wissen" onClick={clearSearch}>×</button> : null}
        </div>
        <button type="submit" disabled={isLoading}>Zoeken</button>
      </form>
      {status === 'idle' ? <p className="collection-page-status">Zoek in de volledige kaartcatalogus.</p> : null}
      {status === 'invalid' ? <p className="status-note" role="alert">Gebruik minimaal drie bruikbare tekens om te zoeken.</p> : null}
      {status === 'loading' ? <p className="collection-page-status" role="status">Zoekresultaten laden…</p> : null}
      {status === 'error' ? <div className="collection-page-empty"><p role="alert">{errorMessage ?? getSafeCatalogSearchErrorMessage()}</p><button type="button" onClick={() => loadSearchResults(activeTerm || input, page)}>Opnieuw proberen</button></div> : null}
      {status === 'empty' ? <div className="collection-page-empty"><p>Geen kaarten gevonden.</p></div> : null}
      {currentCards.length ? <>
        <BinderCardGrid ariaLabel="Zoekresultaten" items={currentCards.map((card) => ({ id: card.id, imageSmall: card.imageSmall, label: `Open ${card.pokemon ?? 'kaart'}${card.number ? `, kaart ${card.number}` : ''}`, isPresent: confirmedPresence(ownershipById.get(card.id)) }))} getButtonRef={(id, element) => element ? cardButtonRefs.current.set(id, element) : cardButtonRefs.current.delete(id)} onSelect={(id) => { const card = currentCards.find((item) => item.id === id); if (card) openCard(card); }} />
        <nav className="collection-page-pagination" aria-label="Zoekresultaten paginatie"><button type="button" disabled={isLoading || page <= 1} onClick={() => loadSearchResults(activeTerm, page - 1)}>Vorige</button><span>Pagina {page} van {totalPages}</span><button type="button" disabled={isLoading || page >= totalPages} onClick={() => loadSearchResults(activeTerm, page + 1)}>Volgende</button></nav>
      </> : null}
    </section>
    {selected ? <CardDetailDialog card={selected} ownership={detailOwnership} mutation={mutation} capabilities={{ canAdd: false, canIncrease: false, canDecrease: false, unavailableReason: 'Beheer is in deze zoekfase niet beschikbaar.' }} copy={{ statusItems: copy.statusItems, physicalPresenceLabel: copy.physicalPresenceLabel, managementMessage: copy.conflictMessage }} readOnly navigation={selectedIndex >= 0 ? { currentIndex: selectedIndex, total: currentCards.length, onPrevious: () => navigateCard(-1), onNext: () => navigateCard(1) } : undefined} onClose={closeCard} onRetryOwnership={() => void retrySelectedOwnership()} /> : null}
  </>;
}
