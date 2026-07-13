import { useEffect, useMemo, useRef, useState } from 'react';

import { checkCollectionReadiness } from '../collections';
import { getSetsCatalog, type SetsCatalogRow } from '../../services/setsCatalogService';
import {
  addCardToCollection,
  isDuplicateCollectionCardError,
} from './services/addCardToCollectionService';
import {
  getSetCards,
  SET_CARDS_BATCH_SIZE,
  type SetCatalogCard,
  type SetCardsSortOption,
} from './services/setCardsService';
import {
  getSetCardCollectionInfoForCatalogCards,
  type SetCardCollectionInfo,
} from './services/setCardCollectionStateService';
import {
  CollectionCardQuantityStateError,
  decreaseCollectionCardQuantity,
  increaseCollectionCardQuantity,
  type ManagedCollectionCard,
} from './services/manageCollectionCardQuantityService';
import { getSetProgressForCollection, type SetProgress } from './services/setsProgressService';
import { calculateSetProgressPercent, getEffectiveSetTotal, hasKnownSetTotal } from './services/setTotals';

type SetsPageState =
  | { status: 'loading'; sets: SetsCatalogRow[]; errorMessage?: undefined }
  | { status: 'success'; sets: SetsCatalogRow[]; errorMessage?: undefined }
  | { status: 'error'; sets: SetsCatalogRow[]; errorMessage: string };

type SetsProgressState = {
  status: 'idle' | 'loading' | 'success' | 'unavailable';
  progressBySetCode: Map<string, SetProgress>;
};

type GroupedSets = {
  series: string;
  sets: SetsCatalogRow[];
};

type SetCardsStatus = 'closed' | 'loading' | 'success' | 'loadingMore' | 'error';

type SetCardsOverlayState = {
  status: SetCardsStatus;
  cards: SetCatalogCard[];
  totalCount: number;
  offset: number;
  hasMore: boolean;
  errorMessage?: string;
};

type SetCardCollectionState = {
  status: 'idle' | 'loading' | 'success' | 'error';
  infoByCardCatalogId: Map<string, SetCardCollectionInfo>;
};

type SetCardMutationState = {
  status: 'idle' | 'adding' | 'increasing' | 'decreasing' | 'deleting' | 'success' | 'error';
  message?: string;
  requestId?: number;
};

const FALLBACK_SERIES_LABEL = 'Overige sets';

const INITIAL_SET_CARDS_OVERLAY_STATE: SetCardsOverlayState = {
  status: 'closed',
  cards: [],
  totalCount: 0,
  offset: 0,
  hasMore: false,
};

const INITIAL_SET_CARD_COLLECTION_STATE: SetCardCollectionState = {
  status: 'idle',
  infoByCardCatalogId: new Map(),
};

const SET_CARDS_SORT_LABELS: Record<SetCardsSortOption, string> = {
  'name-asc': 'Naam A–Z',
  'name-desc': 'Naam Z–A',
};

function formatSetProgressText(ownedCount: number, total: number | null) {
  if (hasKnownSetTotal(total)) {
    return `${ownedCount} van ${total}`;
  }

  if (ownedCount > 0) {
    return `${ownedCount} kaarten verzameld`;
  }

  return 'Nog geen totaal bekend';
}

export function SetsPage() {
  const [setsPageState, setSetsPageState] = useState<SetsPageState>({ status: 'loading', sets: [] });
  const [setsProgressState, setSetsProgressState] = useState<SetsProgressState>({
    status: 'idle',
    progressBySetCode: new Map(),
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [openSetId, setOpenSetId] = useState<string | null>(null);
  const [setCardSearchTerm, setSetCardSearchTerm] = useState('');
  const [debouncedSetCardSearchTerm, setDebouncedSetCardSearchTerm] = useState('');
  const [setCardsSortOption, setSetCardsSortOption] = useState<SetCardsSortOption>('name-asc');
  const [setCardsRetryNonce, setSetCardsRetryNonce] = useState(0);
  const [setCardsOverlayState, setSetCardsOverlayState] =
    useState<SetCardsOverlayState>(INITIAL_SET_CARDS_OVERLAY_STATE);
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null);
  const [setCardCollectionState, setSetCardCollectionState] = useState<SetCardCollectionState>(
    INITIAL_SET_CARD_COLLECTION_STATE,
  );
  const [setCardMutationStates, setSetCardMutationStates] = useState<Record<string, SetCardMutationState>>({});
  const setCardsRequestIdRef = useRef(0);
  const setCardCollectionRequestIdRef = useRef(0);
  const setCardMutationRequestIdRef = useRef(0);
  const setCardMutationRequestIdsByCardRef = useRef(new Map<string, number>());
  const pendingSetCardMutationIdsRef = useRef(new Set<string>());
  const activeCollectionIdRef = useRef<string | null>(null);
  const openSetIdRef = useRef<string | null>(null);
  const loadedSetCardIdsRef = useRef(new Set<string>());
  const setButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const overlayCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const overlayScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadSetsCatalog() {
      setSetsPageState({ status: 'loading', sets: [] });

      try {
        const sets = await getSetsCatalog();

        if (isMounted) {
          setSetsPageState({ status: 'success', sets });
        }
      } catch (error) {
        if (isMounted) {
          setSetsPageState({
            status: 'error',
            sets: [],
            errorMessage: error instanceof Error ? error.message : 'Sets catalog ophalen is mislukt.',
          });
        }
      }
    }

    void loadSetsCatalog();

    return () => {
      isMounted = false;
    };
  }, []);

  const openSet = useMemo(() => {
    if (!openSetId) {
      return null;
    }

    return setsPageState.sets.find((set) => set.id === openSetId) ?? null;
  }, [openSetId, setsPageState.sets]);

  useEffect(() => {
    activeCollectionIdRef.current = activeCollectionId;
  }, [activeCollectionId]);

  useEffect(() => {
    openSetIdRef.current = openSetId;
  }, [openSetId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSetCardSearchTerm(setCardSearchTerm.trim());
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [setCardSearchTerm]);

  useEffect(() => {
    if (!openSet) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    overlayScrollRef.current?.scrollTo({ top: 0 });
    window.setTimeout(() => overlayCloseButtonRef.current?.focus(), 0);

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [openSet]);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape' && openSet) {
        closeSetOverlay();
      }
    }

    window.addEventListener('keydown', handleEscape);

    return () => window.removeEventListener('keydown', handleEscape);
  });

  useEffect(() => {
    if (!openSet) {
      setCardsRequestIdRef.current += 1;
      setSetCardsOverlayState(INITIAL_SET_CARDS_OVERLAY_STATE);
      setSetCardMutationStates({});
      return;
    }

    let isCancelled = false;
    const requestId = setCardsRequestIdRef.current + 1;
    setCardsRequestIdRef.current = requestId;
    const setCode = openSet.set_code;
    const searchTermForRequest = debouncedSetCardSearchTerm;
    const sortOptionForRequest = setCardsSortOption;

    async function loadInitialSetCards() {
      overlayScrollRef.current?.scrollTo({ top: 0 });
      setSetCardsOverlayState({
        status: 'loading',
        cards: [],
        totalCount: 0,
        offset: 0,
        hasMore: false,
      });

      try {
        const result = await getSetCards({
          setCode,
          offset: 0,
          limit: SET_CARDS_BATCH_SIZE,
          searchTerm: searchTermForRequest,
          sortOption: sortOptionForRequest,
        });

        if (!isCancelled && setCardsRequestIdRef.current === requestId) {
          setSetCardsOverlayState({
            status: 'success',
            cards: result.cards,
            totalCount: result.totalCount,
            offset: result.cards.length,
            hasMore: result.hasMore,
          });
        }
      } catch {
        if (!isCancelled && setCardsRequestIdRef.current === requestId) {
          setSetCardsOverlayState({
            status: 'error',
            cards: [],
            totalCount: 0,
            offset: 0,
            hasMore: false,
            errorMessage: 'Kaarten laden is mislukt.',
          });
        }
      }
    }

    void loadInitialSetCards();

    return () => {
      isCancelled = true;
    };
  }, [debouncedSetCardSearchTerm, openSet, setCardsRetryNonce, setCardsSortOption]);

  const loadedSetCardIds = useMemo(() => setCardsOverlayState.cards.map((card) => card.id), [setCardsOverlayState.cards]);
  const loadedSetCardIdsKey = loadedSetCardIds.join(',');

  useEffect(() => {
    loadedSetCardIdsRef.current = new Set(loadedSetCardIds);
  }, [loadedSetCardIdsKey]);

  useEffect(() => {
    const requestId = setCardCollectionRequestIdRef.current + 1;
    setCardCollectionRequestIdRef.current = requestId;

    if (!openSet || !activeCollectionId || loadedSetCardIds.length === 0) {
      setSetCardCollectionState(INITIAL_SET_CARD_COLLECTION_STATE);
      setSetCardMutationStates({});
      return;
    }

    let isCancelled = false;
    const collectionIdForRequest = activeCollectionId;
    const cardCatalogIdsForRequest = loadedSetCardIds;

    async function loadSetCardCollectionState() {
      setSetCardCollectionState({ status: 'loading', infoByCardCatalogId: new Map() });

      try {
        const infoByCardCatalogId = await getSetCardCollectionInfoForCatalogCards({
          collectionId: collectionIdForRequest,
          cardCatalogIds: cardCatalogIdsForRequest,
        });

        if (!isCancelled && setCardCollectionRequestIdRef.current === requestId) {
          setSetCardCollectionState({ status: 'success', infoByCardCatalogId });
        }
      } catch {
        if (!isCancelled && setCardCollectionRequestIdRef.current === requestId) {
          setSetCardCollectionState({ status: 'error', infoByCardCatalogId: new Map() });
        }
      }
    }

    void loadSetCardCollectionState();

    return () => {
      isCancelled = true;
    };
  }, [activeCollectionId, loadedSetCardIdsKey, openSet]);

  function setManagedCollectionCard(cardCatalogId: string, card: ManagedCollectionCard) {
    setSetCardCollectionState((currentState) => {
      if (currentState.status !== 'success') {
        return currentState;
      }

      const infoByCardCatalogId = new Map(currentState.infoByCardCatalogId);
      infoByCardCatalogId.set(cardCatalogId, {
        hasAnyRecord: true,
        manageableOwnedNearMintRow: {
          id: card.id,
          cardCatalogId,
          quantity: card.quantity,
        },
        hasConflictingManageableRows: false,
      });

      return { status: 'success', infoByCardCatalogId };
    });
  }

  function incrementSetProgress(setCode: string) {
    setSetsProgressState((currentState) => {
      if (currentState.status !== 'success') {
        return currentState;
      }

      const currentProgress = currentState.progressBySetCode.get(setCode);

      if (!currentProgress) {
        return currentState;
      }

      const effectiveTotal = getEffectiveSetTotal({
        total: currentProgress.total,
        printed_total: currentProgress.printedTotal,
      });
      const nextOwnedCount = hasKnownSetTotal(effectiveTotal)
        ? Math.min(currentProgress.ownedCount + 1, effectiveTotal)
        : currentProgress.ownedCount + 1;
      const nextProgress: SetProgress = {
        ...currentProgress,
        ownedCount: nextOwnedCount,
        progressPercent: calculateSetProgressPercent(nextOwnedCount, effectiveTotal),
      };
      const nextProgressBySetCode = new Map(currentState.progressBySetCode);
      nextProgressBySetCode.set(setCode, nextProgress);

      return { status: 'success', progressBySetCode: nextProgressBySetCode };
    });
  }

  async function refreshSetProgress(collectionId: string) {
    try {
      const setProgress = await getSetProgressForCollection(collectionId);

      if (activeCollectionIdRef.current !== collectionId) {
        return;
      }

      setSetsProgressState({
        status: 'success',
        progressBySetCode: new Map(setProgress.map((progress) => [progress.setCode, progress])),
      });
    } catch {
      // Keep the current visible progress rather than showing a technical error for a background resync.
    }
  }

  async function refreshVisibleCardCollectionState(collectionId: string, setId: string): Promise<boolean> {
    const cardCatalogIds = [...loadedSetCardIdsRef.current];
    const requestId = setCardCollectionRequestIdRef.current + 1;
    setCardCollectionRequestIdRef.current = requestId;

    if (cardCatalogIds.length === 0) {
      return false;
    }

    setSetCardCollectionState((currentState) => ({
      status: 'loading',
      infoByCardCatalogId: currentState.infoByCardCatalogId,
    }));

    try {
      const infoByCardCatalogId = await getSetCardCollectionInfoForCatalogCards({
        collectionId,
        cardCatalogIds,
      });

      if (
        setCardCollectionRequestIdRef.current !== requestId ||
        activeCollectionIdRef.current !== collectionId ||
        openSetIdRef.current !== setId
      ) {
        return false;
      }

      setSetCardCollectionState({ status: 'success', infoByCardCatalogId });
      return true;
    } catch {
      if (
        setCardCollectionRequestIdRef.current === requestId &&
        activeCollectionIdRef.current === collectionId &&
        openSetIdRef.current === setId
      ) {
        setSetCardCollectionState({ status: 'error', infoByCardCatalogId: new Map() });
      }

      return false;
    }
  }

  function isCurrentCardMutation(
    cardCatalogId: string,
    requestId: number,
    collectionId: string,
    setId: string,
  ): boolean {
    return (
      setCardMutationRequestIdsByCardRef.current.get(cardCatalogId) === requestId &&
      activeCollectionIdRef.current === collectionId &&
      openSetIdRef.current === setId &&
      loadedSetCardIdsRef.current.has(cardCatalogId)
    );
  }

  function beginCardMutation(
    cardCatalogId: string,
    status: SetCardMutationState['status'],
  ): number | null {
    if (pendingSetCardMutationIdsRef.current.has(cardCatalogId)) {
      return null;
    }

    const requestId = setCardMutationRequestIdRef.current + 1;
    setCardMutationRequestIdRef.current = requestId;
    setCardMutationRequestIdsByCardRef.current.set(cardCatalogId, requestId);
    pendingSetCardMutationIdsRef.current.add(cardCatalogId);
    setSetCardMutationStates((currentStates) => ({
      ...currentStates,
      [cardCatalogId]: { status, requestId },
    }));

    return requestId;
  }

  function setCardMutationResult(
    cardCatalogId: string,
    requestId: number,
    status: 'success' | 'error',
    message?: string,
  ) {
    setSetCardMutationStates((currentStates) => ({
      ...currentStates,
      [cardCatalogId]: { status, message, requestId },
    }));
  }

  async function handleAddCardToCollection(card: SetCatalogCard) {
    if (!openSet || !activeCollectionId) {
      setSetCardMutationStates((currentStates) => ({
        ...currentStates,
        [card.id]: { status: 'error', message: 'Geen actieve collectie beschikbaar.' },
      }));
      return;
    }

    const collectionInfo = setCardCollectionState.infoByCardCatalogId.get(card.id);

    if (
      setCardCollectionState.status !== 'success' ||
      !collectionInfo ||
      collectionInfo.hasAnyRecord ||
      collectionInfo.hasConflictingManageableRows
    ) {
      setSetCardMutationStates((currentStates) => ({
        ...currentStates,
        [card.id]: { status: 'error', message: 'Collectiestatus is nog niet bevestigd.' },
      }));
      return;
    }

    const requestId = beginCardMutation(card.id, 'adding');

    if (requestId === null) {
      return;
    }

    const collectionIdForRequest = activeCollectionId;
    const setCodeForRequest = openSet.set_code;
    const openSetIdForRequest = openSet.id;

    try {
      const addedCard = await addCardToCollection({
        collectionId: collectionIdForRequest,
        cardCatalogId: card.id,
      });

      if (!isCurrentCardMutation(card.id, requestId, collectionIdForRequest, openSetIdForRequest)) {
        return;
      }

      setManagedCollectionCard(card.id, addedCard);
      setCardMutationResult(card.id, requestId, 'success', 'Toegevoegd');
      incrementSetProgress(setCodeForRequest);
    } catch (error) {
      if (!isCurrentCardMutation(card.id, requestId, collectionIdForRequest, openSetIdForRequest)) {
        return;
      }

      if (isDuplicateCollectionCardError(error)) {
        await Promise.all([
          refreshVisibleCardCollectionState(collectionIdForRequest, openSetIdForRequest),
          refreshSetProgress(collectionIdForRequest),
        ]);

        if (isCurrentCardMutation(card.id, requestId, collectionIdForRequest, openSetIdForRequest)) {
          setCardMutationResult(
            card.id,
            requestId,
            'error',
            'Aantal is intussen gewijzigd. Status is vernieuwd.',
          );
        }
        return;
      }

      setCardMutationResult(card.id, requestId, 'error', 'Kaart toevoegen is mislukt. Probeer opnieuw.');
    } finally {
      if (setCardMutationRequestIdsByCardRef.current.get(card.id) === requestId) {
        pendingSetCardMutationIdsRef.current.delete(card.id);
        setCardMutationRequestIdsByCardRef.current.delete(card.id);
      }
    }
  }

  async function handleCollectionCardQuantityChange(card: SetCatalogCard, direction: 'increase' | 'decrease') {
    if (!openSet || !activeCollectionId || setCardCollectionState.status !== 'success') {
      return;
    }

    const collectionInfo = setCardCollectionState.infoByCardCatalogId.get(card.id);
    const manageableRow = collectionInfo?.manageableOwnedNearMintRow;

    if (!manageableRow || collectionInfo.hasConflictingManageableRows) {
      return;
    }

    const mutationStatus = direction === 'increase'
      ? 'increasing'
      : manageableRow.quantity === 1
        ? 'deleting'
        : 'decreasing';
    const requestId = beginCardMutation(card.id, mutationStatus);

    if (requestId === null) {
      return;
    }

    const collectionIdForRequest = activeCollectionId;
    const openSetIdForRequest = openSet.id;
    const collectionCardIdForRequest = manageableRow.id;
    const currentQuantityForRequest = manageableRow.quantity;

    try {
      if (direction === 'increase') {
        const updatedCard = await increaseCollectionCardQuantity({
          collectionId: collectionIdForRequest,
          collectionCardId: collectionCardIdForRequest,
          currentQuantity: currentQuantityForRequest,
        });

        if (!isCurrentCardMutation(card.id, requestId, collectionIdForRequest, openSetIdForRequest)) {
          return;
        }

        if (updatedCard.card_catalog_id !== card.id) {
          throw new CollectionCardQuantityStateError('De gewijzigde kaartidentiteit wijkt af.', 'invalid-result');
        }

        setManagedCollectionCard(card.id, updatedCard);
        setCardMutationResult(card.id, requestId, 'success');
        return;
      }

      const result = await decreaseCollectionCardQuantity({
        collectionId: collectionIdForRequest,
        collectionCardId: collectionCardIdForRequest,
        currentQuantity: currentQuantityForRequest,
      });

      if (!isCurrentCardMutation(card.id, requestId, collectionIdForRequest, openSetIdForRequest)) {
        return;
      }

      if (result.action === 'updated') {
        if (result.card.card_catalog_id !== card.id) {
          throw new CollectionCardQuantityStateError('De gewijzigde kaartidentiteit wijkt af.', 'invalid-result');
        }

        setManagedCollectionCard(card.id, result.card);
        setCardMutationResult(card.id, requestId, 'success');
        return;
      }

      await Promise.all([
        refreshVisibleCardCollectionState(collectionIdForRequest, openSetIdForRequest),
        refreshSetProgress(collectionIdForRequest),
      ]);

      if (isCurrentCardMutation(card.id, requestId, collectionIdForRequest, openSetIdForRequest)) {
        setCardMutationResult(card.id, requestId, 'success');
      }
    } catch (error) {
      if (!isCurrentCardMutation(card.id, requestId, collectionIdForRequest, openSetIdForRequest)) {
        return;
      }

      if (error instanceof CollectionCardQuantityStateError) {
        await Promise.all([
          refreshVisibleCardCollectionState(collectionIdForRequest, openSetIdForRequest),
          refreshSetProgress(collectionIdForRequest),
        ]);

        if (isCurrentCardMutation(card.id, requestId, collectionIdForRequest, openSetIdForRequest)) {
          setCardMutationResult(
            card.id,
            requestId,
            'error',
            error.reason === 'stale'
              ? 'Aantal is intussen gewijzigd. Status is vernieuwd.'
              : 'Aantal kon niet veilig worden bevestigd. Status is vernieuwd.',
          );
        }
        return;
      }

      setCardMutationResult(card.id, requestId, 'error', 'Aantal bijwerken is mislukt. Probeer opnieuw.');
    } finally {
      if (setCardMutationRequestIdsByCardRef.current.get(card.id) === requestId) {
        pendingSetCardMutationIdsRef.current.delete(card.id);
        setCardMutationRequestIdsByCardRef.current.delete(card.id);
      }
    }
  }

  async function loadMoreSetCards() {
    if (!openSet || setCardsOverlayState.status === 'loading' || setCardsOverlayState.status === 'loadingMore') {
      return;
    }

    const requestId = setCardsRequestIdRef.current + 1;
    setCardsRequestIdRef.current = requestId;
    const setCode = openSet.set_code;
    const currentOffset = setCardsOverlayState.offset;
    const existingCards = setCardsOverlayState.cards;

    setSetCardsOverlayState((currentState) => ({
      ...currentState,
      status: 'loadingMore',
      errorMessage: undefined,
    }));

    try {
      const result = await getSetCards({
        setCode,
        offset: currentOffset,
        limit: SET_CARDS_BATCH_SIZE,
        searchTerm: debouncedSetCardSearchTerm,
        sortOption: setCardsSortOption,
      });

      if (setCardsRequestIdRef.current === requestId) {
        const seenCardIds = new Set(existingCards.map((card) => card.id));
        const newCards = result.cards.filter((card) => !seenCardIds.has(card.id));
        const cards = [...existingCards, ...newCards];

        setSetCardsOverlayState({
          status: 'success',
          cards,
          totalCount: result.totalCount,
          offset: currentOffset + result.cards.length,
          hasMore: cards.length < result.totalCount,
        });
      }
    } catch {
      if (setCardsRequestIdRef.current === requestId) {
        setSetCardsOverlayState((currentState) => ({
          ...currentState,
          status: 'error',
          errorMessage: 'Meer kaarten laden is mislukt.',
        }));
      }
    }
  }

  function openSetOverlay(setId: string) {
    setSetCardSearchTerm('');
    setDebouncedSetCardSearchTerm('');
    setSetCardsSortOption('name-asc');
    setSetCardsRetryNonce(0);
    setCardsRequestIdRef.current += 1;
    setCardCollectionRequestIdRef.current += 1;
    setSetCardsOverlayState(INITIAL_SET_CARDS_OVERLAY_STATE);
    setSetCardCollectionState(INITIAL_SET_CARD_COLLECTION_STATE);
    setSetCardMutationStates({});
    setOpenSetId(setId);
  }

  function closeSetOverlay() {
    const closingSetId = openSetId;
    setOpenSetId(null);
    setSetCardSearchTerm('');
    setDebouncedSetCardSearchTerm('');
    setSetCardsSortOption('name-asc');
    setSetCardsRetryNonce(0);
    setCardsRequestIdRef.current += 1;
    setCardCollectionRequestIdRef.current += 1;
    setSetCardsOverlayState(INITIAL_SET_CARDS_OVERLAY_STATE);
    setSetCardCollectionState(INITIAL_SET_CARD_COLLECTION_STATE);
    setSetCardMutationStates({});
    window.setTimeout(() => {
      if (closingSetId) {
        setButtonRefs.current.get(closingSetId)?.focus();
      }
    }, 0);
  }

  useEffect(() => {
    let isMounted = true;

    async function loadSetsProgress() {
      setSetsProgressState({ status: 'loading', progressBySetCode: new Map() });
      activeCollectionIdRef.current = null;
      setActiveCollectionId(null);

      try {
        const collectionReadiness = await checkCollectionReadiness();
        const collectionId = collectionReadiness.mainCollection?.id;

        if (collectionReadiness.status !== 'collection-ready' || !collectionId) {
          if (isMounted) {
            setSetsProgressState({ status: 'unavailable', progressBySetCode: new Map() });
          }

          return;
        }

        if (isMounted) {
          activeCollectionIdRef.current = collectionId;
          setActiveCollectionId(collectionId);
        }

        const setProgress = await getSetProgressForCollection(collectionId);
        const progressBySetCode = new Map(setProgress.map((progress) => [progress.setCode, progress]));

        if (isMounted) {
          setSetsProgressState({ status: 'success', progressBySetCode });
        }
      } catch {
        if (isMounted) {
          setSetsProgressState({ status: 'unavailable', progressBySetCode: new Map() });
        }
      }
    }

    void loadSetsProgress();

    return () => {
      isMounted = false;
    };
  }, []);

  const catalogSummary = useMemo(
    () => ({
      loadedSetsCount: setsPageState.sets.length,
      setsWithMetadataCount: setsPageState.sets.filter((set) => set.release_date || hasKnownSetTotal(getEffectiveSetTotal(set))).length,
    }),
    [setsPageState.sets],
  );

  const normalizedSearchTerm = searchTerm.trim().toLowerCase();
  const filteredSets = useMemo(() => {
    if (!normalizedSearchTerm) {
      return setsPageState.sets;
    }

    return setsPageState.sets.filter((set) => {
      const setName = set.name.toLowerCase();
      const seriesName = set.series?.toLowerCase() ?? '';

      return setName.includes(normalizedSearchTerm) || seriesName.includes(normalizedSearchTerm);
    });
  }, [normalizedSearchTerm, setsPageState.sets]);

  const groupedSets = useMemo(() => {
    return filteredSets.reduce<GroupedSets[]>((groups, set) => {
      const series = set.series ?? FALLBACK_SERIES_LABEL;
      const existingGroup = groups.find((group) => group.series === series);

      if (existingGroup) {
        existingGroup.sets.push(set);
      } else {
        groups.push({ series, sets: [set] });
      }

      return groups;
    }, []);
  }, [filteredSets]);

  const isLoading = setsPageState.status === 'loading';
  const isError = setsPageState.status === 'error';
  const isEmpty = setsPageState.status === 'success' && setsPageState.sets.length === 0;
  const hasNoSearchResults = setsPageState.status === 'success' && setsPageState.sets.length > 0 && filteredSets.length === 0;

  return (
    <section className="sets-page" aria-labelledby="sets-page-title">
      <div className="sets-page-hero">
        <p className="eyebrow">Set-catalogus</p>
        <h2 id="sets-page-title">Sets</h2>
        <p>Volledige set-catalogus met collectievoortgang wanneer die beschikbaar is.</p>
      </div>

      <dl className="sets-page-summary" aria-label="Samenvatting van de set-catalogus">
        <div>
          <dt>Sets geladen</dt>
          <dd>{catalogSummary.loadedSetsCount}</dd>
        </div>
        <div>
          <dt>Sets met metadata</dt>
          <dd>{catalogSummary.setsWithMetadataCount}</dd>
        </div>
      </dl>

      {setsProgressState.status === 'loading' ? (
        <p className="sets-page-progress-note" role="status">
          Collectievoortgang wordt geladen...
        </p>
      ) : null}

      <section className="sets-page-card" aria-labelledby="sets-page-catalog-title">
        <h3 id="sets-page-catalog-title">Set-catalog</h3>

        <div className="sets-page-search">
          <label htmlFor="sets-page-search-input">Zoeken</label>
          <div className="sets-page-search-control">
            <input
              id="sets-page-search-input"
              type="search"
              placeholder="Zoek set..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
            {searchTerm ? (
              <button type="button" aria-label="Zoekterm wissen" onClick={() => setSearchTerm('')}>
                ×
              </button>
            ) : null}
          </div>
        </div>

        {isLoading ? <p role="status">Sets worden geladen...</p> : null}

        {isError ? (
          <p role="alert">Fout bij het laden van de sets: {setsPageState.errorMessage}</p>
        ) : null}

        {isEmpty ? <p>Er zijn nog geen sets beschikbaar in de catalog.</p> : null}

        {hasNoSearchResults ? <p>Geen sets gevonden.</p> : null}

        {groupedSets.length > 0 ? (
          <div className="sets-page-series-list" aria-label="Beschikbare sets per series">
            {groupedSets.map((group, index) => {
              const seriesHeadingId = `sets-page-series-${index}`;

              return (
                <section key={group.series} className="sets-page-series-group" aria-labelledby={seriesHeadingId}>
                  <h4 id={seriesHeadingId} className="sets-page-series-heading">
                    {group.series}
                  </h4>

                  <ul className="sets-page-catalog-grid" aria-label={`${group.series} sets`}>
                    {group.sets.map((set) => {
                      const setProgress = setsProgressState.progressBySetCode.get(set.set_code);
                      const ownedCount = setProgress?.ownedCount ?? 0;
                      const effectiveSetTotal = getEffectiveSetTotal(set);
                      const progressPercent = calculateSetProgressPercent(ownedCount, effectiveSetTotal);
                      const setImageUrl = set.logo_url ?? set.symbol_url;
                      const setImageAlt = set.logo_url ? `${set.name} logo` : `${set.name} symbool`;
                      const isOpen = openSetId === set.id;

                      return (
                        <li key={set.id} className={`sets-page-set-card${isOpen ? ' is-open' : ''}`}>
                          <button
                            ref={(buttonElement) => {
                              if (buttonElement) {
                                setButtonRefs.current.set(set.id, buttonElement);
                              }
                            }}
                            type="button"
                            className="sets-page-set-summary-button"
                            aria-expanded={isOpen}
                            aria-controls={isOpen ? 'sets-page-set-overlay' : undefined}
                            onClick={() => openSetOverlay(set.id)}
                          >
                            <span className="sets-page-set-media" aria-hidden={setImageUrl ? undefined : true}>
                              {setImageUrl ? (
                                <img src={setImageUrl} alt={setImageAlt} width="96" height="40" loading="lazy" />
                              ) : (
                                <span className="sets-page-set-media-placeholder">Geen logo</span>
                              )}
                            </span>

                            <span className="sets-page-set-content">
                              <span className="sets-page-set-heading">
                                <strong className="sets-page-set-name">{set.name}</strong>
                              </span>

                              <span className="sets-page-set-progress" aria-label={`Collectievoortgang voor ${set.name}`}>
                                <span>{formatSetProgressText(ownedCount, effectiveSetTotal)}</span>
                                {progressPercent !== null ? (
                                  <span
                                    className="sets-page-set-progress-bar"
                                    role="progressbar"
                                    aria-valuemin={0}
                                    aria-valuemax={100}
                                    aria-valuenow={progressPercent}
                                    aria-label={`${progressPercent}% compleet`}
                                  >
                                    <span style={{ width: `${progressPercent}%` }} />
                                  </span>
                                ) : null}
                              </span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </div>
        ) : null}
      </section>

      {openSet ? (() => {
        const setProgress = setsProgressState.progressBySetCode.get(openSet.set_code);
        const ownedCount = setProgress?.ownedCount ?? 0;
        const effectiveSetTotal = getEffectiveSetTotal(openSet);
        const progressPercent = calculateSetProgressPercent(ownedCount, effectiveSetTotal);
        const isInitialLoading = setCardsOverlayState.status === 'loading';
        const isLoadingMore = setCardsOverlayState.status === 'loadingMore';
        const hasCards = setCardsOverlayState.cards.length > 0;
        const isSearchActive = debouncedSetCardSearchTerm.length > 0;
        const showInitialError = setCardsOverlayState.status === 'error' && !hasCards;
        const showLoadMoreError = setCardsOverlayState.status === 'error' && hasCards;
        const showEmptyState =
          setCardsOverlayState.status === 'success' && setCardsOverlayState.totalCount === 0 && !isSearchActive;
        const showSearchEmptyState =
          setCardsOverlayState.status === 'success' && setCardsOverlayState.totalCount === 0 && isSearchActive;
        const showCollectionStateError = setCardCollectionState.status === 'error';

        return (
          <div
            id="sets-page-set-overlay"
            className="sets-page-set-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sets-page-set-overlay-title"
          >
            <header className="sets-page-set-overlay-header">
              <button
                ref={overlayCloseButtonRef}
                type="button"
                className="sets-page-set-overlay-back"
                aria-label="Terug naar sets"
                onClick={closeSetOverlay}
              >
                ←
              </button>
              <div>
                <p className="sets-page-set-overlay-kicker">Set</p>
                <h3 id="sets-page-set-overlay-title">{openSet.name}</h3>
              </div>
            </header>

            <div ref={overlayScrollRef} className="sets-page-set-overlay-scroll">
              <section className="sets-page-set-overlay-summary" aria-label="Setinformatie">
                <div>
                  <span>Setnaam</span>
                  <strong>{openSet.name}</strong>
                </div>
                {openSet.series ? (
                  <div>
                    <span>Series</span>
                    <strong>{openSet.series}</strong>
                  </div>
                ) : null}
                <div>
                  <span>Releasedatum</span>
                  <strong>{openSet.release_date ?? 'Onbekend'}</strong>
                </div>
                <div>
                  <span>Verzameld</span>
                  <strong>{formatSetProgressText(ownedCount, effectiveSetTotal)}</strong>
                </div>
                <div>
                  <span>Officieel settotaal</span>
                  <strong>{hasKnownSetTotal(effectiveSetTotal) ? effectiveSetTotal : 'Niet bekend'}</strong>
                </div>
                <div>
                  <span>Cataloguskaarten beschikbaar</span>
                  <strong>{setCardsOverlayState.totalCount}</strong>
                </div>
                {progressPercent !== null ? (
                  <div className="sets-page-set-overlay-progress">
                    <span>Voortgang</span>
                    <strong>{progressPercent}%</strong>
                    <span
                      className="sets-page-set-progress-bar"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={progressPercent}
                      aria-label={`${progressPercent}% compleet`}
                    >
                      <span style={{ width: `${progressPercent}%` }} />
                    </span>
                  </div>
                ) : null}
              </section>

              <section className="sets-page-set-overlay-controls" aria-label="Kaarten zoeken en sorteren">
                <label htmlFor="sets-page-set-card-search">Zoek kaarten</label>
                <div className="sets-page-set-card-search-control">
                  <input
                    id="sets-page-set-card-search"
                    type="search"
                    placeholder="Zoek naam of nummer..."
                    value={setCardSearchTerm}
                    onChange={(event) => setSetCardSearchTerm(event.target.value)}
                  />
                  {setCardSearchTerm ? (
                    <button type="button" aria-label="Kaartzoekterm wissen" onClick={() => setSetCardSearchTerm('')}>
                      ×
                    </button>
                  ) : null}
                </div>

                <label htmlFor="sets-page-set-card-sort">Sorteren</label>
                <select
                  id="sets-page-set-card-sort"
                  value={setCardsSortOption}
                  onChange={(event) => setSetCardsSortOption(event.target.value as SetCardsSortOption)}
                >
                  {Object.entries(SET_CARDS_SORT_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </section>

              {isInitialLoading ? (
                <div className="sets-page-set-card-skeleton-grid" role="status" aria-live="polite" aria-label="Kaarten laden">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <span key={index} className="sets-page-set-card-skeleton" />
                  ))}
                </div>
              ) : null}

              {showInitialError ? (
                <div className="sets-page-set-overlay-message" role="alert">
                  <p>{setCardsOverlayState.errorMessage}</p>
                  <button type="button" onClick={() => setSetCardsRetryNonce((retryNonce) => retryNonce + 1)}>
                    Opnieuw proberen
                  </button>
                </div>
              ) : null}

              {showEmptyState ? (
                <p className="sets-page-set-overlay-empty">Voor deze set zijn nog geen cataloguskaarten beschikbaar.</p>
              ) : null}

              {showSearchEmptyState ? (
                <p className="sets-page-set-overlay-empty">Geen kaarten gevonden voor deze zoekopdracht.</p>
              ) : null}

              {showCollectionStateError ? (
                <p className="sets-page-set-card-collection-status-message" role="alert">
                  Collectiestatus kon niet worden geladen.
                </p>
              ) : null}

              {hasCards ? (
                <>
                  <p className="sets-page-set-overlay-count">
                    {setCardsOverlayState.cards.length} van {setCardsOverlayState.totalCount} cataloguskaarten getoond
                  </p>
                  <ul className="sets-page-set-overlay-grid" aria-label={`Cataloguskaarten voor ${openSet.name}`}>
                    {setCardsOverlayState.cards.map((card) => {
                      const isCollectionStateLoaded = setCardCollectionState.status === 'success';
                      const collectionInfo = setCardCollectionState.infoByCardCatalogId.get(card.id);
                      const hasConflictingRows = collectionInfo?.hasConflictingManageableRows ?? false;
                      const manageableRow = collectionInfo?.manageableOwnedNearMintRow;
                      const hasAnyRecord = collectionInfo?.hasAnyRecord ?? false;
                      const collectionStateLabel = isCollectionStateLoaded && collectionInfo
                        ? hasConflictingRows
                          ? 'Status onbekend'
                          : hasAnyRecord
                            ? 'In collectie'
                            : 'Niet in collectie'
                        : setCardCollectionState.status === 'loading'
                          ? 'Status laden…'
                          : 'Status onbekend';
                      const collectionStateClassName = isCollectionStateLoaded && collectionInfo && !hasConflictingRows
                        ? hasAnyRecord
                          ? ' is-present'
                          : ' is-absent'
                        : ' is-unknown';
                      const mutationState = setCardMutationStates[card.id];
                      const isMutating =
                        mutationState?.status === 'adding' ||
                        mutationState?.status === 'increasing' ||
                        mutationState?.status === 'decreasing' ||
                        mutationState?.status === 'deleting';
                      const isAdding = mutationState?.status === 'adding';
                      const showAddButton =
                        isCollectionStateLoaded && Boolean(collectionInfo) && !hasAnyRecord && !hasConflictingRows;
                      const canAddCard = showAddButton && !isMutating;
                      const showQuantityControls =
                        isCollectionStateLoaded && Boolean(manageableRow) && !hasConflictingRows;
                      const showManageElsewhere =
                        isCollectionStateLoaded && hasAnyRecord && !manageableRow && !hasConflictingRows;
                      const feedbackMessage =
                        mutationState?.status === 'success' || mutationState?.status === 'error'
                          ? mutationState.message
                          : undefined;

                      return (
                        <li key={card.id} className="sets-page-set-overlay-card">
                          {card.image_small ? (
                            <img
                              src={card.image_small}
                              alt={`${card.pokemon} kaart ${card.number ?? ''}`.trim()}
                              width="120"
                              height="168"
                              loading="lazy"
                              decoding="async"
                            />
                          ) : (
                            <span className="sets-page-set-overlay-card-placeholder" aria-hidden="true">
                              Geen afbeelding
                            </span>
                          )}
                          <span className="sets-page-set-overlay-card-body">
                            <strong>{card.pokemon}</strong>
                            <span>Nr. {card.number ?? 'onbekend'}</span>
                            {card.rarity ? <span>{card.rarity}</span> : null}
                            <span className={`sets-page-set-card-collection-badge${collectionStateClassName}`}>
                              {collectionStateLabel}
                            </span>
                            {showAddButton ? (
                              <button
                                type="button"
                                className="sets-page-set-card-add-button"
                                disabled={!canAddCard}
                                onClick={() => void handleAddCardToCollection(card)}
                              >
                                {isAdding ? 'Toevoegen…' : 'Toevoegen'}
                              </button>
                            ) : null}
                            {showQuantityControls && manageableRow ? (
                              <span
                                className="sets-page-set-card-quantity-control"
                                role="group"
                                aria-label="Aantal in collectie"
                              >
                                <button
                                  type="button"
                                  aria-label="Eén exemplaar verwijderen"
                                  disabled={isMutating}
                                  onClick={() => void handleCollectionCardQuantityChange(card, 'decrease')}
                                >
                                  −
                                </button>
                                <span>{isMutating ? 'Bijwerken…' : `${manageableRow.quantity} in bezit`}</span>
                                <button
                                  type="button"
                                  aria-label="Eén exemplaar toevoegen"
                                  disabled={isMutating}
                                  onClick={() => void handleCollectionCardQuantityChange(card, 'increase')}
                                >
                                  +
                                </button>
                              </span>
                            ) : null}
                            {showManageElsewhere ? (
                              <span className="sets-page-set-card-manage-elsewhere">Beheer via collectie</span>
                            ) : null}
                            {hasConflictingRows ? (
                              <span className="sets-page-set-card-manage-elsewhere is-error">Gegevensconflict</span>
                            ) : null}
                            {feedbackMessage ? (
                              <span
                                className={`sets-page-set-card-add-message${
                                  mutationState?.status === 'error' ? ' is-error' : ' is-success'
                                }`}
                                role={mutationState?.status === 'error' ? 'alert' : 'status'}
                              >
                                {feedbackMessage}
                              </span>
                            ) : null}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </>
              ) : null}

              {showLoadMoreError ? (
                <div className="sets-page-set-overlay-message" role="alert">
                  <p>{setCardsOverlayState.errorMessage}</p>
                </div>
              ) : null}

              {setCardsOverlayState.hasMore && hasCards ? (
                <div className="sets-page-set-overlay-load-more">
                  <button type="button" disabled={isLoadingMore} onClick={() => void loadMoreSetCards()}>
                    {isLoadingMore ? 'Meer kaarten laden…' : 'Meer kaarten laden'}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        );
      })() : null}
    </section>
  );
}
