# Pokémon Collection V3 — AI Workflow Versions

## Workflow v2 — 2026-07-22

### Doel

Codex-opdrachten verkorten zonder doel, veiligheid, testkwaliteit of PR-discipline te verliezen.

### Wijzigingen

- Eén vast startpunt: `docs/00_CODEX_ENTRYPOINT.md`.
- YAML is het standaardformaat voor nieuwe Codex-opdrachten.
- Herhaalde uitvoeringsregels zijn gecentraliseerd in `codex/profiles.yaml`.
- Taaktypes gebruiken herbruikbare templates in `codex/templates/`.
- PR-rapportage gebruikt één repositorytemplate.
- Testselectie is risico- en wijzigingsgestuurd; niet iedere taak herhaalt of draait automatisch dezelfde volledige checklist.
- Een expliciete instructieprioriteit voorkomt dat oude status, roadmaptekst of chatcontext actuele evidence overschrijft.
- Nieuwe algemene lessen worden toegevoegd aan de bestaande documenteigenaar, niet aan iedere toekomstige prompt.

### Compatibiliteit

Bestaande projectdocumenten blijven voorlopig op hun huidige paden. Workflow v2 voegt een routerings- en configuratielaag toe en hernoemt geen bestaande bron van waarheid.

### Nieuwe standaardopdracht

```yaml
repository: FreDCFR8/Pokemon-Collection
entrypoint: docs/00_CODEX_ENTRYPOINT.md
template: bugfix
task: Herstel het concreet beschreven probleem.
overrides: []
```

## Workflow v1 — historische werkwijze

Workflow v1 gebruikte volledige natuurlijke-taalopdrachten waarin projectcontext, algemene veiligheid, tests, PR-vereisten en rapportage telkens opnieuw werden uitgeschreven.

Deze methode was bruikbaar tijdens de opbouw van de projectafspraken, maar werd te lang, moeilijk kopieerbaar en gevoelig voor duplicatie en onderlinge afwijkingen.

## Wijzigingsregel

Een toekomstige workflowversie wordt alleen toegevoegd wanneer de manier van samenwerken structureel verandert. Kleine verduidelijkingen worden rechtstreeks in het relevante entrypoint, profiel, template of brondocument verwerkt.