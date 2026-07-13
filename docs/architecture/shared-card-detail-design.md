# Shared Card Detail — architectuur- en UX-ontwerp

## Doel en grenzen

Phase 7C-2D1 definieert één Card Detail voor Sets en Collection, later herbruikbaar voor Wishlist, Trade en Search. Dit document is uitsluitend ontwerp: geen runtime-, CSS-, database-, RLS- of configuratiewijziging hoort bij deze fase.

De vaste scheiding blijft: `cards_catalog` beschrijft de kaart; `collection_cards` beschrijft de staat van die kaart binnen één collectie. Card Detail toont alleen bevestigde data en bevat zelf geen Supabase-client, query of mutatie.

## Huidige beperkingen

### Sets

- `SetsPage.tsx` coördineert setcatalogus, binder, detaildialoog, focus, ownershipreads, mutaties, conflictherstel en voortgang in één groot page-component.
- Card Detail is JSX en state binnen Sets en kent daardoor `openSet`, geladen binderkaarten en Sets-specifieke request-refs rechtstreeks.
- De in wezen generieke ownership-, add- en quantityservices staan onder `setsPage/services` en exporteren Sets-specifieke typen.
- Alleen één geldige `owned` + `Near Mint`-rij is direct beheerbaar. Andere statussen/condities worden samengevat als “In collectie / Beheer via collectie”; meerdere beheerbare rijen worden een conflict.
- Ownership wordt alleen voor de zichtbare binderbatch geladen. Een mislukte read is veilig “onbekend”, maar Card Detail biedt geen expliciete retry voor die read.
- Mutaties beschermen al tegen dubbele requests, stale quantity en een gewijzigde context, maar deze regels zijn page-local en daardoor niet herbruikbaar.
- De dialoog zet begin- en retourfocus en ondersteunt Escape, maar heeft geen aantoonbare focus trap/inert achtergrond. Card Detail is bovendien een tweede modale laag boven de setoverlay.
- Mobiel gebruikt bijna het volledige viewport; desktop centreert dezelfde smalle, hoofdzakelijk verticale indeling en benut bredere ruimte nog niet doelgericht.

### Collection

- Collection is een read-only, metadata-zware lijst zonder selecteerbare kaart of detailflow.
- `CollectionPageCard` bevat geen `cardCatalogId`, `collectionCardId`, `collectionId` of large image. De render-key is afgeleid van veranderlijke tekst en index.
- De query reduceert `collection_cards` tot de eerste relationele rij. Daardoor zijn meerdere statussen/condities en conflicten niet expliciet modelleerbaar.
- Catalogus- en ownershipdata zijn in één page-readmodel vermengd; status en conditie zijn vrije strings en mutatiegedrag ontbreekt.
- Laden vervangt de zichtbare pagina door een generieke loading state. Fouten hebben tekst maar geen expliciete retry; filterfouten hebben evenmin een retryactie.

## Verantwoordelijkheden

```text
Sets/Collection contextadapter
  → haalt kaart- en collectiestaat via gedeelde services
  → vertaalt context naar stabiele detailprops en capabilities
  → coördineert retry, refresh, stale-responsebescherming en afgeleide paginastaat
Shared Card Detail
  → rendert kaart, status en toegestane acties
  → emit alleen intenties en lifecycle-events
  → kent Supabase, pagina, route en querymodel niet
Generieke collection-card services
  → lezen en muteren collection_cards
  → valideren serverresultaten en leveren getypeerde conflicten
Supabase + RLS/constraints
  → operationele bron van waarheid en laatste autorisatiegrens
```

### Shared Card Detail

Een voorgestelde featuregrens is `src/features/cardDetail/`. De component is controlled en ontvangt minimaal:

```ts
type CardDetailProps = {
  card: CardDetailCard;
  ownership: CollectionOwnershipState;
  mutation: CollectionMutationState;
  capabilities: CardDetailCapabilities;
  copy: CardDetailProductCopy;
  onClose(): void;
  onRetryOwnership?(): void;
  onAdd?(): void;
  onIncrease?(): void;
  onDecrease?(): void;
};
```

`capabilities` beschrijft expliciet wat de actuele context mag aanbieden, bijvoorbeeld `canAdd`, `canIncrease`, `canDecrease` en een reden wanneer beheer niet beschikbaar is. `copy` levert producttekst per expliciete `CollectionStatus`; ieder statusitem behoudt daarbij zijn statuscode, zodat tekst nooit de onderliggende betekenis vervangt. De component leidt bevoegdheid of wording niet af uit paginanaam of ruwe databasewaarden. Hij bezit alleen tijdelijke presentatiestaat, zoals een geopende sectie; bevestigde ownership en pending mutaties blijven controlled inputs.

### Contextadapters

De adapters zijn dunne containers/hooks buiten het gedeelde presentatiedeel:

- **Sets-adapter:** gebruikt de geselecteerde stabiele `cardCatalogId`, actieve `collectionId` en setnaam; behoudt de bestaande add- en ±1-regels; werkt de binder-marker en setvoortgang na bevestigde wijzigingen bij; negeert responses van een gesloten set, andere kaart of andere collectie; retourneert focus naar de geopende bindertile. De eerste extractie mag de bestaande generieke tekst “In collectie / Beheer via collectie” tijdelijk mappen voor functionele parity, maar uitsluitend als lokale compatibiliteit en nooit als gedeelde domeinregel.
- **Collection-adapter:** verrijkt het page-readmodel eerst met stabiele IDs, large image en alle relevante ownershipinformatie; opent dezelfde detailcomponent vanuit een kaartresultaat; retourneert focus naar de kaarttile en ververst alleen het betrokken resultaat of de begrensde pagina. De eerste integratie blijft read-only indien mutation parity nog niet afzonderlijk is goedgekeurd. De adapter bepaalt capabilities en productcopy uit het volledige statusgescheiden snapshot en mag daarvoor geen statussen wegfilteren of samenvoegen.

Adapters mogen dezelfde services gebruiken, maar delen geen Sets- of Collection-page state met elkaar. Contextwijziging invalideert lopende reads en intenties; een late response mag nooit de nieuwe context overschrijven.

## Gedeelde services buiten `setsPage`

Plaats generieke logica bijvoorbeeld onder `src/features/collectionCards/services/`:

- `collectionCardStateService`: gebatchte read voor `{ collectionId, cardCatalogIds }`; initialiseert ook bevestigde afwezigheid; groepeert alle rows per kaart; normaliseert en valideert waarden; geeft een `Map<cardCatalogId, CollectionOwnershipState>` terug zonder UI-copy.
- `collectionCardMutationService`: `addOwnedNearMint`, `increaseQuantity` en `decreaseQuantity`; normaliseert invoer, gebruikt collection- en row-ID plus expected current quantity, valideert de volledige serverresponse en vertaalt duplicate/stale/invalid-result naar getypeerde domeinfouten.
- Een kleine pure projector groepeert geldige rows expliciet als `owned`, `wishlist`, `trade` en `missing`, bepaalt een eventuele beheerbare owned Near Mint-row en signaleert `absent` of `conflict`. Hij leidt fysieke aanwezigheid uitsluitend af uit `owned` en `trade`. Dezelfde projector wordt door batch- en single-cardreads gebruikt.

Deze services bevatten de Supabase-calls; de shared detailcomponent nooit. Ze bevestigen geen succes op basis van alleen een foutloze request. RLS en bestaande databaseconstraints blijven leidend en worden in deze ontwerpfase niet gewijzigd. Page-specifieke voortgang, paginatie, filters en binderrefresh blijven buiten deze generieke services.

## Stabiele datacontracten

Gebruik camelCase UI/domeincontracten en map databasekolommen uitsluitend aan de servicegrens. Veranderlijke labels zijn nooit identiteit.

```ts
type CardDetailCard = {
  cardCatalogId: string;
  name: string;
  number: string | null;
  set: { setCode: string | null; name: string | null };
  rarity: string | null;
  images: { small: string | null; large: string | null };
};

type CollectionStatus = 'owned' | 'wishlist' | 'trade' | 'missing';

type OwnershipRecord<S extends CollectionStatus = CollectionStatus> = {
  collectionCardId: string;
  collectionId: string;
  cardCatalogId: string;
  quantity: number;
  condition: string | null;
  status: S;
};

type OwnershipByStatus = {
  owned: OwnershipRecord<'owned'>[];
  wishlist: OwnershipRecord<'wishlist'>[];
  trade: OwnershipRecord<'trade'>[];
  missing: OwnershipRecord<'missing'>[];
};

type OwnershipSnapshot = {
  byStatus: OwnershipByStatus;
  physicalPresence: 'present' | 'absent';
  manageableOwnedNearMintRecord?: OwnershipRecord<'owned'>;
};

type ConfirmedOwnership =
  | { kind: 'absent' }
  | { kind: 'snapshot'; value: OwnershipSnapshot }
  | { kind: 'conflict'; value?: OwnershipSnapshot; reason: string };

type CollectionOwnershipState =
  | { status: 'idle' }
  | { status: 'loading'; previous?: ConfirmedOwnership }
  | { status: 'ready'; value: ConfirmedOwnership }
  | { status: 'error'; previous?: ConfirmedOwnership; retryable: boolean };

type CollectionMutationState =
  | { status: 'idle' }
  | { status: 'pending'; operation: 'add' | 'increase' | 'decrease' | 'delete' }
  | { status: 'success' }
  | { status: 'error'; operation: string; retryable: boolean }
  | { status: 'conflict'; operation: string; refreshStatus: 'pending' | 'ready' | 'error' };

type CardDetailProductCopy = {
  statusItems: Array<{ status: CollectionStatus; label: string }>;
  physicalPresenceLabel?: string;
  managementMessage?: string;
};
```

IDs en positieve quantity zijn verplicht gevalideerd. Onbekende statuswaarden worden niet stil als afwezig of beheerbaar behandeld: de service levert een veilig conflict/ongeldig-resultaat. `physicalPresence` is alleen `present` als minstens één geldige `owned`- of `trade`-row bestaat; quantity verandert die booleaanse betekenis niet. `wishlist` en `missing` betekenen nooit fysieke aanwezigheid. Iedere status blijft afzonderlijk beschikbaar, ook bij meerdere gelijktijdige records. `conflict` betekent ambigue of invalide data. Alleen `ready/absent` bewijst dat er geen enkele collection-state-row bestaat.

## UX en toegankelijkheid

### Mobile-first

- Card Detail is op smalle iPhones een full-height sheet/dialog met safe-area-padding, één eigen scrollcontainer en een blijvend bereikbare close/backactie van minimaal circa 44 × 44 CSS-pixels.
- De grote afbeelding staat eerst, blijft volledig zichtbaar met contain-gedrag en valt terug op small image; daarna volgen naam, set/nummer, ownership en acties. Secundaire kenmerken zijn progressive disclosure.
- De status/quantity blijft op één stabiele plek; pending, fout of conflict veroorzaakt geen layoutwissel. Plus en min zijn duidelijk gescheiden, minimaal 44 × 44 en nooit alleen door kleur verklaard.

### Desktop

- Centreer en begrens de dialoog in beide dimensies. Vanaf voldoende breedte mag een tweekolomsindeling ontstaan: afbeelding links, metadata en beheer rechts; voorkom uitgerekte tekst en onnodig lange verticale scroll.
- Hover is alleen verbetering. Sluiten, retry en mutaties blijven volledig met toetsenbord bruikbaar.

### Dialog- en focuscontract

- Slechts de bovenste dialoog is interactief: onderliggende setoverlay/pagina is inert of anders aantoonbaar uit de focusvolgorde en accessibility tree gehouden.
- Gebruik native `<dialog>` wanneer dit betrouwbaar in de bestaande app past, anders een correcte `role="dialog"`, `aria-modal="true"`, gelabelde titel en waar nuttig een beschrijving.
- Trap focus binnen Card Detail, zet initiële focus voorspelbaar op close/back, sluit met Escape en herstel focus naar de exacte trigger als die nog bestaat; kies anders een logisch contextanker.
- Backdrop-sluiten is aanvullend en mag geen onbedoelde drag/touch als sluitactie interpreteren. Close blijft tijdens loading en pending beschikbaar.
- Icon-only acties krijgen een naam; betekenisvolle async wijzigingen gebruiken één rustige `aria-live="polite"`-regio. Fouten die directe aandacht vragen gebruiken `role="alert"`, zonder dubbele aankondigingen.

## Toestanden en herstel

| Situatie | Gedrag |
|---|---|
| Detail opent / ownership laadt | Toon kaartdata direct, status “Status laden…”, disable beheer; eerder bevestigde staat mag zichtbaar blijven met een loading-aanduiding. |
| Kaartdata ontbreekt | Render geen lege of kapotte beheerflow; context toont een veilige fout en close/terug. Een ontbrekende afbeelding krijgt een neutrale placeholder en is geen fatal error. |
| Bevestigd zonder records | Toon “Niet in collectie”; bied add alleen aan als capability en contract dit toestaan. |
| Owned | Toon “In collectie” of “N in collectie”; dit is fysieke aanwezigheid en quantitybeheer is alleen beschikbaar bij een eenduidige beheerbare owned Near Mint-row. |
| Trade | Toon statusbewust “Voor ruil” en, waar relevant, dat de kaart fysiek aanwezig is; presenteer trade nooit als generiek owned. |
| Wishlist | Toon “Op wishlist”; toon nooit een fysieke-aanwezigheidsmarker of “In collectie” op basis van wishlist alleen. |
| Missing | Toon “Ontbreekt”; toon nooit een fysieke-aanwezigheidsmarker of “In collectie” op basis van missing alleen. |
| Meerdere statussen | Toon afzonderlijke statusitems en bepaal fysieke aanwezigheid alleen uit owned/trade; de adapter bepaalt contextcopy zonder records of statuscodes te verliezen. |
| Ownership-read faalt | Toon “Status onbekend”, nooit “Niet in collectie”; disable beheer en bied expliciete retry. |
| Mutatie pending | Behoud laatst bevestigde staat, toon “Bijwerken…”, blokkeer alleen concurrerende acties voor deze kaart; close blijft mogelijk. |
| Mutatie slaagt | Neem uitsluitend de gevalideerde serverstate over, kondig de wijziging kort aan en synchroniseer contextafgeleiden. |
| Gewone mutatiefout | Behoud de vorige bevestigde state, geef compacte fout + retry van de intentie of ownershiprefresh; geen optimistisch succes. |
| Duplicate/stale/invalid result | Markeer conflict, disable beheer, refresh ownership en contextafgeleiden; meld daarna dat de status is vernieuwd. Mislukt refresh, blijf “onbekend” met retry. |
| Context wisselt of detail sluit | Laat de write uitlopen als die de server kan hebben bereikt, maar negeer late UI-responses; een volgende opening leest opnieuw. Claim geen annulering van een mogelijke write. |
| Niet-beheerbare of conflicterende rows | Toon iedere geldige status met statusbewuste wording en zo nodig “Beheer via collectie”; toon “Gegevensconflict” bij ambiguïteit en voer geen quantitymutatie uit. |

Een detail heeft geen zoek-empty state: zoek- en lijst-empty horen bij de adapter. De shared component ondersteunt wel ontbrekende optionele metadata zonder technische IDs of lege labels te tonen.

## Toekomstige reuse

- **Wishlist:** gebruikt expliciet `byStatus.wishlist`; “Op wishlist” blijft onderscheiden van owned/trade en impliceert nooit fysieke aanwezigheid. De adapter bepaalt toegestane overgangen en copy zonder de andere statusgroepen te verwijderen.
- **Trade:** gebruikt expliciet `byStatus.trade`; trade telt als fysieke aanwezigheid maar blijft productmatig “Voor ruil”, niet generiek “In collectie”. Meerdere records/condities blijven zichtbaar in het snapshot; toekomstige acties worden capabilities/intenties en geen conditionals op een paginanaam.
- **Search:** catalogusresultaten leveren hetzelfde `CardDetailCard` en alle statusgroepen voor de gekozen kaart; een fysieke marker volgt alleen uit owned/trade. Ownership wordt begrensd voor alleen zichtbare/gekozen IDs geladen, nooit via een volledige-catalogusread.
- **Missing:** gebruikt expliciet `byStatus.missing`; “Ontbreekt” blijft een eigen toestand en mag nooit als fysieke aanwezigheid worden weergegeven.

Nieuwe statussen of acties breiden `CollectionStatus`, `OwnershipByStatus`, het copycontract en de serviceprojector bewust en samen uit. De basiscomponent wordt niet vooraf een algemene workflow-engine en bevat geen Wishlist-, Trade- of Search-querylogica.

## Kleine implementatiefasen

1. **Contracten en servicegrens:** introduceer statusgescheiden gedeelde typen en generieke services buiten `setsPage`; behoud bestaande exports tijdelijk als compatibiliteitslaag en bewijs met tests dat reads, add, ±1, delete, fysieke-aanwezigheidsregels en conflictsemantiek gelijk blijven.
2. **Shared presentational detail + Sets-adapter:** extraheer de huidige Sets-detailflow met functionele en mobiele visuele parity; bestaande generieke Sets-copy mag alleen in deze adapter tijdelijk blijven. Voeg focus trap, inert achtergrond en ownership-retry gecontroleerd toe. Binder, paginatie en setvoortgang blijven verder ongewijzigd.
3. **Collection-readmodel:** voeg stabiele catalogus-/ownership-IDs, large image en expliciete ownershipprojectie toe zonder de bestaande lijst, filters, paginatie of read-only gedrag te veranderen.
4. **Collection-adapter:** maak Collection-kaarten selecteerbaar en open shared detail aanvankelijk met read-only capabilities; verifieer mobile, desktop, focus, loading/error/retry en terugkeer naar het juiste resultaat.
5. **Gedeeld beheer activeren:** schakel Collection-mutaties pas in een aparte, goedgekeurde fase in; synchroniseer page-resultaat na bevestigde writes en test stale/conflictgedrag. Verwijder compatibiliteit en Sets-specifieke duplicatie pas na parity.
6. **Latere contexten afzonderlijk:** voeg Wishlist, Trade en Search één voor één via adapters toe wanneer hun productregels zijn ontworpen; verbreed contracten alleen op bewezen behoefte.

Elke fase blijft één doelgerichte PR, behoudt eerst bestaand gedrag en vereist technische én UX-review. Runtimefasen verifiëren minimaal build/typecheck, relevante tests, `git diff --check`, iPhone, desktop, toetsenbord/focus en de fout-, retry-, pending- en conflictpaden.
