import { useEffect, useMemo, useRef, useState } from 'react';
import { BinderCardGrid } from '../../components/BinderCardGrid';
import { CardDetailDialog, type CardDetailCard, type CardDetailMutationState } from '../cardDetail';
import { getCollectionCardOwnershipForCatalogCards, type CollectionOwnershipState, type ConfirmedOwnership } from '../collectionCards';
import { checkCollectionReadiness } from '../collections';
import { getCardDetailNavigationState } from '../cardDetail/cardDetailGallery';
import { createCardDetailOwnershipPresentation } from '../cardDetail/cardDetailOwnershipPresentation';
import { searchCatalog } from './catalogSearchService';
import { isCatalogSearchTermValid, normalizeCatalogSearchTerm, shouldApplyCatalogSearchResponse } from './catalogSearchHelpers';
import { toCatalogSearchCardDetailCard } from './catalogSearchCardDetailAdapter';
import { CATALOG_SEARCH_PAGE_SIZE, type CatalogSearchCard, type CatalogSearchResult } from './catalogSearchTypes';

function confirmedPresence(value: ConfirmedOwnership | undefined): boolean { return value?.kind === 'snapshot' && value.value.physicalPresence === 'present'; }

export function CatalogSearchPage() {
  const [input, setInput] = useState('');
  const [activeTerm, setActiveTerm] = useState('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<CatalogSearchResult | null>(null);
  const [status, setStatus] = useState<'idle' | 'invalid' | 'loading' | 'ready' | 'empty' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [ownershipById, setOwnershipById] = useState<Map<string, ConfirmedOwnership>>(new Map());
  const [ownershipState, setOwnershipState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [selected, setSelected] = useState<CardDetailCard | null>(null);
  const [detailOwnership, setDetailOwnership] = useState<CollectionOwnershipState>({ status: 'idle' });
  const requestId = useRef(0);
  const detailRequestId = useRef(0);
  const cardButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const currentCards = result?.cards ?? [];
  const totalPages = Math.max(1, Math.ceil((result?.totalCount ?? 0) / CATALOG_SEARCH_PAGE_SIZE));
  const selectedIndex = selected ? currentCards.findIndex((card) => card.id === selected.cardCatalogId) : -1;
  const searchContext = useRef({ term: '', page: 1 });
  searchContext.current = { term: activeTerm, page };

  const load = (term: string, nextPage: number) => {
    const normalized = normalizeCatalogSearchTerm(term);
    if (!isCatalogSearchTermValid(normalized)) { setStatus('invalid'); setResult(null); return; }
    const currentRequest = ++requestId.current;
    setActiveTerm(normalized); setPage(nextPage); setStatus('loading'); setErrorMessage(null); setSelected(null); setOwnershipById(new Map()); setOwnershipState('loading');
    searchCatalog(normalized, nextPage).then(async (nextResult) => {
      if (!shouldApplyCatalogSearchResponse(requestId.current, currentRequest)) return;
      setResult(nextResult); setStatus(nextResult.cards.length ? 'ready' : 'empty');
      try {
        const readiness = await checkCollectionReadiness();
        const collectionId = readiness.mainCollection?.id;
        if (!collectionId) { if (shouldApplyCatalogSearchResponse(requestId.current, currentRequest)) setOwnershipState('error'); return; }
        const ownership = await getCollectionCardOwnershipForCatalogCards({ collectionId, cardCatalogIds: nextResult.cards.map((card) => card.id) });
        if (shouldApplyCatalogSearchResponse(requestId.current, currentRequest)) { setOwnershipById(ownership); setOwnershipState('ready'); }
      } catch { if (shouldApplyCatalogSearchResponse(requestId.current, currentRequest)) setOwnershipState('error'); }
    }).catch((error: unknown) => {
      if (!shouldApplyCatalogSearchResponse(requestId.current, currentRequest)) return;
      setStatus('error'); setErrorMessage(error instanceof Error ? error.message : 'Zoeken is mislukt.'); setOwnershipState('error');
    });
  };

  const openCard = (card: CatalogSearchCard) => {
    const detailCard = toCatalogSearchCardDetailCard(card);
    const ownership = ownershipById.get(card.id);
    setSelected(detailCard); detailRequestId.current += 1;
    setDetailOwnership(ownership ? { status: 'ready', value: ownership } : ownershipState === 'error' ? { status: 'error', retryable: true } : { status: 'loading' });
  };
  const closeCard = () => { const id = selected?.cardCatalogId; detailRequestId.current += 1; setSelected(null); setDetailOwnership({ status: 'idle' }); window.setTimeout(() => id && cardButtonRefs.current.get(id)?.focus(), 0); };
  const navigate = (direction: -1 | 1) => { if (selectedIndex < 0) return; const next = currentCards[selectedIndex + direction]; if (next) openCard(next); };
  const retryOwnership = () => { if (activeTerm) load(activeTerm, page); };
  const copy = useMemo(() => createCardDetailOwnershipPresentation({ ownership: detailOwnership.status === 'ready' ? detailOwnership.value : undefined }), [detailOwnership]);
  const mutation: CardDetailMutationState = { status: 'idle' };

  useEffect(() => () => { requestId.current += 1; detailRequestId.current += 1; }, []);
  const isLoading = status === 'loading';

  return <>
    <section className="collection-page catalog-search-page" aria-labelledby="catalog-search-title" inert={selected ? true : undefined}>
      <div className="collection-page-header"><h2 id="catalog-search-title">Zoeken</h2></div>
      <form className="collection-page-search" onSubmit={(event) => { event.preventDefault(); load(input, 1); }}>
        <div className="collection-page-search-control"><input type="search" value={input} maxLength={80} aria-label="Catalogus zoeken" placeholder="Zoek op Pokémon, set of nummer" onChange={(event) => setInput(event.target.value)} />{input ? <button type="button" aria-label="Zoekterm wissen" onClick={() => { setInput(''); setActiveTerm(''); setResult(null); setStatus('idle'); }}>×</button> : null}</div>
        <button type="submit" disabled={isLoading}>Zoeken</button>
      </form>
      {status === 'idle' ? <p className="collection-page-status">Zoek in de volledige kaartcatalogus.</p> : null}
      {status === 'invalid' ? <p className="status-note" role="alert">Gebruik minimaal twee bruikbare tekens om te zoeken.</p> : null}
      {status === 'loading' ? <p className="collection-page-status" role="status">Zoekresultaten laden…</p> : null}
      {status === 'error' ? <div className="collection-page-empty"><p role="alert">{errorMessage ?? 'Zoeken is mislukt.'}</p><button type="button" onClick={() => load(activeTerm || input, page)}>Opnieuw proberen</button></div> : null}
      {status === 'empty' ? <div className="collection-page-empty"><p>Geen kaarten gevonden.</p></div> : null}
      {currentCards.length ? <><BinderCardGrid ariaLabel="Zoekresultaten" items={currentCards.map((card) => ({ id: card.id, imageSmall: card.imageSmall, label: `Open ${card.pokemon ?? 'kaart'}${card.number ? `, kaart ${card.number}` : ''}`, isPresent: confirmedPresence(ownershipById.get(card.id)) }))} getButtonRef={(id, element) => element ? cardButtonRefs.current.set(id, element) : cardButtonRefs.current.delete(id)} onSelect={(id) => { const card = currentCards.find((item) => item.id === id); if (card) openCard(card); }} /><nav className="collection-page-pagination" aria-label="Zoekresultaten paginatie"><button type="button" disabled={isLoading || page <= 1} onClick={() => load(activeTerm, page - 1)}>Vorige</button><span>Pagina {page} van {totalPages}</span><button type="button" disabled={isLoading || page >= totalPages} onClick={() => load(activeTerm, page + 1)}>Volgende</button></nav></> : null}
    </section>
    {selected ? <CardDetailDialog card={selected} ownership={detailOwnership} mutation={mutation} capabilities={{ canAdd: false, canIncrease: false, canDecrease: false, unavailableReason: 'Beheer is in deze zoekfase niet beschikbaar.' }} copy={{ statusItems: copy.statusItems, physicalPresenceLabel: copy.physicalPresenceLabel, managementMessage: copy.conflictMessage }} readOnly navigation={selectedIndex >= 0 ? { currentIndex: selectedIndex, total: currentCards.length, onPrevious: () => navigate(-1), onNext: () => navigate(1) } : undefined} onClose={closeCard} onRetryOwnership={retryOwnership} /> : null}
  </>;
}
