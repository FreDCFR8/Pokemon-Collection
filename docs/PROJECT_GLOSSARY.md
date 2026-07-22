# Pokémon Collection V3 — Project Glossary

Dit document definieert terugkerende projecttermen. Technische details en beslissingen blijven in hun eigen brondocumenten.

## Catalogus en collectie

- **`cards_catalog`** — centrale interne kaartcatalogus; beschrijft wat een kaart is.
- **`collection_cards`** — collectie-specifieke toestand van een cataloguskaart, zoals hoeveelheid, conditie en status.
- **`sets_catalog`** — canonieke interne setmetadata.
- **`card_external_references`** — koppelingen tussen stabiele interne kaart-ID's en externe kaartidentiteiten.
- **`set_external_references`** — koppelingen tussen canonieke interne sets en externe setidentiteiten.
- **canonieke set** — de interne `sets_catalog`-rij die als projectidentiteit voor een set geldt.
- **external reference** — brongebonden identiteit die naast de interne stabiele identiteit wordt bewaard.
- **alias** — externe of alternatieve identifier die gecontroleerd naar een canonieke interne identiteit verwijst.
- **legacy** — historisch model of pad dat niet meer voor nieuwe runtimefunctionaliteit wordt gebruikt.

## Import en validatie

- **dry-run** — volledige analyse en theoretisch wijzigingsplan zonder databasewrites.
- **write approval** — expliciete toestemming van de projecteigenaar voor exact beschreven writes; nooit impliciet afgeleid uit een dry-run.
- **planned writes** — theoretische wijzigingen die een run zou uitvoeren wanneer writes toegestaan zijn.
- **database writes** — werkelijk uitgevoerde wijzigingen in de database.
- **idempotency** — dezelfde goedgekeurde operatie opnieuw uitvoeren verandert de correcte eindtoestand niet en creëert geen duplicaten.
- **manifest** — bevroren, machineleesbare beschrijving van bron, scope, verwachte input en/of exacte write-doelen.
- **preflight** — read-only controle vóór implementatie of writes om schema, identiteit, aantallen en stopvoorwaarden te bewijzen.
- **postcheck** — controle na een goedgekeurde wijziging van exacte doelen, totalen, links, uitzonderingen en beschermde data.
- **matching** — bepalen welke externe kaart of set bij welke interne identiteit hoort.
- **backfill** — gecontroleerd aanvullen van ontbrekende bestaande metadata of references zonder de identiteit te vervangen.
- **audit** — bewijsgerichte read-only beoordeling die bevindingen classificeert en geen correctie claimt.
- **PASS** — alle toepasselijke criteria zijn bewezen voor de exacte beoordeelde scope.
- **BLOCKED** — de operatie mag niet doorgaan wegens een harde veiligheids-, identity- of correctheidsblokkade.
- **NEEDS_MANUAL_REVIEW** — automatische beslissing is onvoldoende betrouwbaar; menselijke beoordeling is vereist.
- **ACTION_REQUIRED** — de audit vond een probleem dat nog niet door de audit zelf is opgelost.

## Workflow

- **entrypoint** — het enige vaste startdocument dat Codex naar relevante bronnen, profielen en templates routeert.
- **profile** — centrale set standaardregels voor een taaktype, inclusief scope, veiligheid en toepasselijke controles.
- **template** — compacte YAML-structuur voor een concreet taaktype die een profiel gebruikt.
- **override** — expliciet goedgekeurde afwijking van een standaardprofiel; alleen opnemen wanneer werkelijk nodig.
- **coherent doel** — één afgebakend resultaat dat logisch in één branch en PR kan worden beoordeeld en teruggedraaid.
- **remote PR head** — de exacte commit die op GitHub als head van de PR staat en waarop claims en controles moeten steunen.
- **Definition of Done** — alle toepasselijke technische, UX-, data-, deployment- en documentatievoorwaarden voor afronding.