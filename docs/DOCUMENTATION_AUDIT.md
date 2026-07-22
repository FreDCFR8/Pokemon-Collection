# Pokémon Collection V3 — Documentation Audit

_Date: 2026-07-22_

## Doel en methode

De bestaande duurzame projectdocumentatie is gecontroleerd op dubbele regels, tegenstellingen, verouderde toestand en onduidelijk eigenaarschap. Deze eerste audit voert geen brede hernoeming of verwijdering uit. Workflow v2 legt eerst één routeringslaag en duidelijke documenteigenaars vast.

## Gecontroleerde kernbronnen

- `docs/project/PROJECT_CHARTER_V2.md`
- `docs/project/PROJECT_STATUS.md`
- `docs/project/AI_WORKING_AGREEMENT.md`
- `docs/project/DECISION_LOG.md`
- `docs/project/ROADMAP.md` en relevante specialistische verwijzingen waar ze vanuit de kernbronnen werden aangewezen

## Bevestigde duplicatie

### Ontwikkel- en PR-discipline

De regels `main` stabiel, één branch per doel, één PR per coherent doel, analyse vóór implementatie en correctierondes binnen dezelfde PR staan zowel in het Charter, de Working Agreement als deels in het Decision Log.

**Besluit:**
- het Charter blijft eigenaar van het blijvende principe;
- de Working Agreement blijft eigenaar van uitvoerings- en uitzonderingsdetails;
- `codex/profiles.yaml` maakt deze regels operationeel voor opdrachten;
- het Decision Log bewaart alleen de historische beslissing en reden.

### Tests, build, diff en Definition of Done

Dezelfde controles worden herhaald in het Charter, de Working Agreement en lange Codex-prompts.

**Besluit:**
- de Working Agreement blijft de duurzame Definition of Done;
- profielen selecteren alleen toepasselijke controles per taaktype;
- de PR-template rapporteert uitgevoerde en bewust niet-toepasselijke controles;
- toekomstige prompts herhalen de algemene checklist niet.

### Database- en importsafety

Read-only preflight, dry-run, expliciete writegoedkeuring, idempotency, postchecks en bescherming van `collection_cards` komen terug in Charter, Working Agreement en vele importbeslissingen.

**Besluit:**
- Charter bewaart de permanente data-invarianten;
- Working Agreement bewaart bewijs- en autorisatieregels;
- `catalog-import` en `database-migration` profielen operationaliseren deze regels;
- fasebeslissingen blijven in het Decision Log voor historische traceerbaarheid.

### Architectuur-, security- en performanceregels

Meerdere kernregels komen zowel in Charter als Working Agreement voor.

**Besluit:**
- Charter en specialistische architectuurdocs zijn inhoudelijke eigenaar;
- Working Agreement beschrijft uitsluitend hoe deze tijdens analyse en review worden toegepast;
- prompts nemen alleen taakspecifieke uitzonderingen op.

## Vastgestelde spanning of veroudering

### Lange Codex-opdracht versus workflow v2

`PROJECT_CHARTER_V2.md` en `AI_WORKING_AGREEMENT.md` stellen nog dat iedere Codex-opdracht volledige context, verificatie en PR-vereisten zelf bevat. Dit was geldig voor workflow v1, maar botst met het nieuwe entrypoint-, profiel- en templatemodel.

**Oplossing in deze PR:** gerichte tekstwijzigingen maken centrale verwijzing gelijkwaardig aan expliciete herhaling. De inhoudelijke vereisten blijven behouden.

### Projectstatus is achterhaald

`PROJECT_STATUS.md` vermeldt als volgende stap nog de read-only audit van 18 exception sets en een oudere `main`-positie, terwijl latere merges en projectwerk bestaan.

**Behandeling:** deze workflow-PR wijzigt de operationele projectstatus niet op basis van chatcontext alleen. De status moet in een afzonderlijke, evidence-gedreven statusupdate worden herijkt vanuit actuele `main`, gemergede PR's en operationele rapporten.

### Beslissingslog bevat workflowbeslissingen én technische fasebeslissingen

Dit is niet tegenstrijdig, maar het grote volume maakt gericht lezen belangrijk.

**Behandeling:** het entrypoint verplicht relevante zoekgerichte lezing in plaats van het volledige log telkens te kopiëren of volledig te verwerken.

## Geen bevestigde harde architectuurtegenstelling

Binnen de gecontroleerde kernbronnen is geen harde tegenstelling gevonden over:

- `cards_catalog` als centrale kaartcatalogus;
- `collection_cards` als collectie-specifieke toestand;
- Supabase als runtime source of truth;
- externe bronnen als gecontroleerde import- en synchronisatiebron;
- `main` stabiel houden;
- databasewrites alleen na expliciete, afgebakende toestemming;
- technische én UX-goedkeuring voor user-facing werk.

## Documenteigenaars vanaf workflow v2

| Onderwerp | Enige primaire eigenaar |
|---|---|
| Projectidentiteit en stabiele principes | `docs/project/PROJECT_CHARTER_V2.md` |
| Actuele operationele toestand | `docs/project/PROJECT_STATUS.md` |
| Samenwerking, bevoegdheden en bewijsregels | `docs/project/AI_WORKING_AGREEMENT.md` |
| Blijvende beslissing en reden | `docs/project/DECISION_LOG.md` |
| Richting en geplande fasen | `docs/project/ROADMAP.md` |
| Codex-routering | `docs/00_CODEX_ENTRYPOINT.md` |
| Taakstandaarden | `codex/profiles.yaml` |
| Compacte opdrachten | `codex/templates/` |
| Terminologie | `docs/PROJECT_GLOSSARY.md` |

## Vervolgadvies

Voer latere inhoudelijke opschoning alleen gericht uit wanneer een concrete dubbele passage onderhoudsrisico veroorzaakt. Vermijd één grote herschrijving van alle projectdocs: dat zou historische context en bestaande verwijzingen onnodig riskeren.