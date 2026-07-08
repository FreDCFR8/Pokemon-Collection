# Phase 2W — Manual Legacy Cards Import Execution Log

## 1. Doel

Deze fase documenteert de manuele uitvoering van de legacy import vanuit de Supabase SQL Editor.

De import verplaatst de gecontroleerde Lars legacy kaartdata vanuit `public.cards` naar de nieuwe Phase 2 collection-structuur:

```text
profiles -> collections -> collection_cards -> cards_catalog
```

Deze fase is uitsluitend een uitvoeringslog. Er wordt in deze repository geen runtime code toegevoegd, geen SQL uitgevoerd, geen database gewijzigd en geen nieuwe import gestart.

## 2. Uitgevoerde import

De volgende stappen zijn manueel uitgevoerd in de Supabase SQL Editor:

- Dry-run checks uitgevoerd.
- Catalog import uitgevoerd.
- Collection ownership import uitgevoerd.
- Eindcontrole uitgevoerd.

De uitvoering volgde het eerder gedocumenteerde Lars-only importplan voor legacy records uit `public.cards` naar `public.cards_catalog` en `public.collection_cards`.

## 3. Resultaten

### Dry-run

Alle dry-run resultaten waren zoals verwacht.

| Controle | Resultaat |
| --- | ---: |
| Lars legacy rows | 2190 |
| Missing pokemon | 0 |
| Non-positive quantity | 0 |
| Unknown status | 0 |
| Lars main collection count | 1 |

### Catalog import

| Controle | Resultaat |
| --- | ---: |
| `lars_main_collection_count` | 1 |
| `source_rows` | 2190 |
| `inserted_catalog_rows` | 2190 |
| `imported_catalog_rows` | 2190 |

### Collection cards import

| Controle | Resultaat |
| --- | ---: |
| `lars_main_collection_count` | 1 |
| `source_rows` | 2190 |
| `ownership_source_rows` | 2190 |
| `inserted_collection_card_rows` | 2190 |
| `imported_lars_collection_cards` | 2190 |

### Final verification

| Controle | Resultaat |
| --- | ---: |
| Lars imported cards | 2190 |
| Lore imported cards | 0 |
| Sample records | Looked normal |
| `public.cards` | Remains untouched legacy source |

## 4. Scope

Deze fase bevestigt expliciet de volgende grenzen:

- Geen runtime code gewijzigd.
- Geen app-query toegevoegd.
- Geen `public.cards` writes uitgevoerd.
- Geen Lore import uitgevoerd.
- Geen UUIDs of secrets gedocumenteerd.
- Geen rollback uitgevoerd.

## 5. Nieuwe database status

Na de manuele uitvoering is de verwachte database status:

- `public.cards_catalog` bevat nu 2190 records met `external_source = 'legacy_public_cards'`.
- `public.collection_cards` bevat nu 2190 Lars ownership records.
- Lore hoofdcollectie blijft leeg.
- `public.cards` blijft de legacy/importbron.

## 6. Volgende fase voorstel

### Phase 2X — Read-only Collection Cards Service

Doel: de app mag na login voor het eerst read-only kaarten uit de nieuwe structuur laden:

```text
profiles -> collections -> collection_cards -> cards_catalog
```

Beperkingen:

- Alleen read-only.
- Alleen huidige ingelogde gebruiker.
- Geen `public.cards`.
- Geen writes.
- Eerst alleen count en kleine preview, nog geen volledige kaartgalerij.
