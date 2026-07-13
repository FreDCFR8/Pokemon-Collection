# Pokémon Collection V3 — New Chat Starter

Use this short prompt when starting a new main chat inside the same ChatGPT project.

```text
We werken verder aan Pokémon Collection V3.

Repository:
FreDCFR8/Pokemon-Collection

Lees eerst volledig:
- docs/project/PROJECT_CHARTER_V2.md
- docs/project/PROJECT_STATUS.md
- docs/project/DECISION_LOG.md
- docs/project/AI_WORKING_AGREEMENT.md
- docs/project/ROADMAP.md
- docs/project/UX_GUIDELINES.md
- docs/project/ARCHITECTURE_PRINCIPLES.md

Bevestig daarna:
1. de huidige projectfase;
2. de laatst gemergede mijlpaal;
3. de eerstvolgende aanbevolen stap;
4. relevante risico's of betere alternatieven.

Werkregels:
- antwoord altijd in het Nederlands;
- analyseer eerst architectuur en UX;
- stel pas daarna implementatie of een Codex-opdracht voor;
- main blijft stabiel;
- één branch = één doel;
- één PR = één fase;
- technische én UX-review zijn vereist vóór merge;
- iPhone is de primaire referentie voor user-facing werk;
- desktop wordt gecontroleerd wanneer relevant;
- hergebruik gaat vóór duplicatie;
- data is de bron van waarheid;
- documentatie is de duurzame projectcontext.

De actieve vraag voor deze chat is:
[PLAATS HIER DE NIEUWE VRAAG OF FASE]
```

## When a full prompt is needed

Inside the same ChatGPT project, the short starter above is sufficient because project instructions and recent project context are also available. The repository documents remain the authoritative source.

Use a longer project-identity prompt only when:

- starting outside the Pokémon V3 ChatGPT project;
- handing the repository to a new contributor or tool;
- the project instructions are unavailable;
- a completely isolated environment needs the role and workflow explained.

Do not copy entire old chat histories into a new chat. Provide only the current unresolved task and latest evidence.