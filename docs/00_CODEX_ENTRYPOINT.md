# Pokémon Collection V3 — Codex Entrypoint

Dit is het enige vaste startdocument voor nieuwe Codex-opdrachten.

## Gebruik

Een normale opdracht verwijst alleen naar dit bestand en kiest één profiel of template uit `codex/`.

```yaml
repository: FreDCFR8/Pokemon-Collection
entrypoint: docs/00_CODEX_ENTRYPOINT.md
template: bugfix
task: Beschrijf hier uitsluitend het concrete doel.
```

## Verplichte leesroute

Codex leest alleen wat voor het gekozen taaktype relevant is:

1. `docs/project/PROJECT_STATUS.md` — actuele operationele toestand en volgende goedgekeurde stap.
2. `docs/project/PROJECT_CHARTER_V2.md` — stabiele product- en architectuurprincipes.
3. `docs/project/AI_WORKING_AGREEMENT.md` — samenwerking, bevoegdheden en uitzonderingsregels.
4. `docs/project/DECISION_LOG.md` — alleen relevante blijvende beslissingen.
5. Specialistische documenten die door de taak, het profiel of bovenstaande documenten worden aangewezen.

Lees geen volledige documentverzameling zonder aantoonbare relevantie. Zoek gericht naar de betrokken fase, tabel, component, workflow of eerdere beslissing.

## Instructieprioriteit

Bij schijnbare tegenspraak geldt:

1. expliciete opdracht en expliciete toestemming van de projecteigenaar;
2. actuele productie-evidence en huidige code op de doelbranch;
3. `PROJECT_STATUS.md` voor actuele operationele toestand;
4. blijvende beslissingen in `DECISION_LOG.md`;
5. stabiele principes in `PROJECT_CHARTER_V2.md`;
6. uitvoeringsregels in `AI_WORKING_AGREEMENT.md` en `codex/profiles.yaml`;
7. oudere rapporten en chatcontext uitsluitend als achtergrond.

Een lagere bron mag nooit stilzwijgend een hogere bron overschrijven. Meld een echte tegenstelling en kies de veiligste niet-destructieve interpretatie.

## Taakconfiguratie

- Profielen: `codex/profiles.yaml`
- Templates: `codex/templates/`
- PR-rapportage: `.github/pull_request_template.md`
- Workflowversies: `docs/AI_WORKFLOW_VERSION.md`
- Begrippen: `docs/PROJECT_GLOSSARY.md`
- Documentatie-audit: `docs/DOCUMENTATION_AUDIT.md`

Templates erven hun standaardregels uit het gekozen profiel. De opdracht vermeldt alleen afwijkingen en taak-specifieke acceptatiecriteria.

## Permanente grenzen

- `main` blijft stabiel.
- Eén branch en één PR per coherent doel, tenzij het profiel expliciet read-only is.
- Geen databasewrite, merge, force-push, secretwijziging of scope-uitbreiding zonder expliciete toestemming.
- Correcties blijven in dezelfde PR zolang het oorspronkelijke doel gelijk blijft.
- Tests worden gekozen op basis van risico en gewijzigde bestanden; niet iedere taak voert automatisch de volledige suite uit.
- Claims als `PASS`, `ready` of `published` vereisen bewijs van de exacte remote PR-head wanneer code of operationele tooling is gewijzigd.
- Een documentatie-only taak wijzigt geen runtimecode, database of dependencies.

## Documentatie-eigenaarschap

- Charter: stabiele identiteit, architectuur en productprincipes.
- Status: uitsluitend actuele toestand en eerstvolgende goedgekeurde stap.
- Working Agreement: samenwerking, bevoegdheden, bewijs- en uitzonderingsregels.
- Decision Log: blijvende beslissingen plus reden; geen uitvoeringschecklists.
- Roadmap: richting en fasering; geen operationele waarheid.
- Specialistische docs: gedetailleerde domeincontracten.

Wanneer een nieuwe algemene preventieregel ontstaat, werk de bestaande eigenaar bij. Maak geen nieuw document wanneer een bestaande eigenaar volstaat. Incidentdetails horen niet in permanente prompts.

## Minimale opdracht

```yaml
repository: FreDCFR8/Pokemon-Collection
entrypoint: docs/00_CODEX_ENTRYPOINT.md
template: feature

task: >
  Concrete taak in één tot vijf zinnen.

overrides: []
```

Gebruik `overrides` alleen voor echte afwijkingen, bijvoorbeeld expliciet goedgekeurde databasewrites of een beperktere testscope.