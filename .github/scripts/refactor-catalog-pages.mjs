import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const write = (path, content) => fs.writeFileSync(path, content);

function replaceExactly(source, pattern, replacement, label) {
  const matches = source.match(pattern);
  if (!matches || matches.length !== 1) throw new Error(`${label}: expected one match`);
  return source.replace(pattern, replacement);
}

const sharedImport = "import { CatalogFilterSelect, CatalogPageHeader } from '../../components/catalogPage/CatalogPageHeader';\n";

let collection = read('src/features/collectionPage/CollectionPage.tsx');
collection = collection.replace("import { BinderCardGrid } from '../../components/BinderCardGrid';\n", "import { BinderCardGrid } from '../../components/BinderCardGrid';\n" + sharedImport);
collection = replaceExactly(collection, /type CollectionHeaderProps =[\s\S]*?\nexport function CollectionPage/, 'export function CollectionPage', 'collection local chrome');
collection = replaceExactly(collection, /        <CollectionHeader[\s\S]*?        \/>\n\n        <CollectionToolbar[\s\S]*?        \/>/, `        <CatalogPageHeader
          title="Collectie"
          titleId="collection-page-title"
          subtitle={\`van \${displayName}\`}
          statusMessage={collectionPageState.status !== 'ready' ? collectionPageState.message : undefined}
          errorMessage={collectionPageState.errorMessage}
          searchId="collection-page-search-input"
          searchLabel="Collectie zoeken"
          searchPlaceholder="Zoek op Pokémon, set of nummer"
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          onSearchClear={clearSearch}
          onSearchSubmit={applySearchImmediately}
          hasActiveCriteria={hasActiveCriteria}
          onClearAll={clearAllCriteria}
          filters={
            <>
              <CatalogFilterSelect
                ariaLabel="Filter op rarity"
                label="Rarity"
                value={filters.rarity ?? ''}
                options={filterOptions.rarities.map((rarity) => ({ label: rarity, value: rarity }))}
                onChange={(value) => updateFilter('rarity', value)}
                disabled={areFilterOptionsLoading && filterOptions.rarities.length === 0}
              />
              <CatalogFilterSelect
                ariaLabel="Filter op set"
                label="Set"
                value={filters.setCode ?? ''}
                options={filterOptions.sets.map((set) => ({ label: set.name, value: set.setCode }))}
                onChange={(value) => updateFilter('setCode', value)}
                disabled={areFilterOptionsLoading && filterOptions.sets.length === 0}
              />
            </>
          }
          toolbarFooter={
            <>
              {filterOptionsError ? <p className="status-note">Slimme filters laden is mislukt: {filterOptionsError}</p> : null}
              {hasActiveCriteria ? <p className="catalog-page-search-summary">Actief: {searchSummary || activeSearchTerm}</p> : null}
            </>
          }
        />`, 'collection chrome usage');
write('src/features/collectionPage/CollectionPage.tsx', collection);

let wishlist = read('src/features/wishlistPage/WishlistPage.tsx');
wishlist = wishlist.replace("import { BinderCardGrid } from '../../components/BinderCardGrid';\n", "import { BinderCardGrid } from '../../components/BinderCardGrid';\n" + sharedImport);
wishlist = replaceExactly(wishlist, /type WishlistToolbarProps =[\s\S]*?\nexport function WishlistPage/, 'export function WishlistPage', 'wishlist local toolbar');
wishlist = replaceExactly(wishlist, /        <header className="collection-page-header">[\s\S]*?        <WishlistToolbar[\s\S]*?        \/>/, `        <CatalogPageHeader
          title="Wishlist"
          titleId="wishlist-page-title"
          subtitle={\`van \${displayName}\`}
          statusMessage={pageState.status !== 'ready' ? pageState.message : undefined}
          errorMessage={pageState.errorMessage}
          headerAction={pageState.status === 'error' ? <button type="button" onClick={retryWishlist}>Wishlist opnieuw laden</button> : null}
          searchId="wishlist-page-search-input"
          searchLabel="Wishlist zoeken"
          searchPlaceholder="Zoek op Pokémon, set of nummer"
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          onSearchClear={clearSearch}
          onSearchSubmit={applySearchImmediately}
          hasActiveCriteria={hasActiveCriteria}
          onClearAll={clearAllCriteria}
          filters={
            <>
              <CatalogFilterSelect
                ariaLabel="Filter op rarity"
                label="Rarity"
                value={filters.rarity ?? ''}
                options={filterOptions.rarities.map((rarity) => ({ label: rarity, value: rarity }))}
                onChange={(value) => updateFilter('rarity', value)}
                disabled={isLoadingOptions && filterOptions.rarities.length === 0}
              />
              <CatalogFilterSelect
                ariaLabel="Filter op set"
                label="Set"
                value={filters.setCode ?? ''}
                options={filterOptions.sets.map((set) => ({ label: set.name, value: set.setCode }))}
                onChange={(value) => updateFilter('setCode', value)}
                disabled={isLoadingOptions && filterOptions.sets.length === 0}
              />
            </>
          }
        />`, 'wishlist chrome usage');
write('src/features/wishlistPage/WishlistPage.tsx', wishlist);

let sets = read('src/features/setsPage/SetsPage.tsx');
sets = sets.replace("import { calculateSetProgressPercent, getEffectiveSetTotal, hasKnownSetTotal } from './services/setTotals';\n", "import { calculateSetProgressPercent, getEffectiveSetTotal, hasKnownSetTotal } from './services/setTotals';\n" + sharedImport);
sets = sets.replace("  const [selectedSeries, setSelectedSeries] = useState('all');\n", "  const [selectedSeries, setSelectedSeries] = useState('all');\n  const [progressFilter, setProgressFilter] = useState('');\n");
sets = replaceExactly(sets, /  const catalogSummary = useMemo\([\s\S]*?  const seriesOptions = useMemo\(/, '  const seriesOptions = useMemo(', 'sets catalog summary');
sets = replaceExactly(sets, /      const matchesSeries = selectedSeries === 'all' \|\| seriesName === selectedSeries;[\s\S]*?  }, \[normalizedSearchTerm, selectedSeries, setsPageState\.sets\]\);/, `      const matchesSeries = selectedSeries === 'all' || seriesName === selectedSeries;
      const setProgress = setsProgressState.progressBySetCode.get(set.set_code);
      const ownedCount = setProgress?.ownedCount ?? 0;
      const effectiveSetTotal = getEffectiveSetTotal(set);
      const isComplete = hasKnownSetTotal(effectiveSetTotal) && ownedCount >= effectiveSetTotal;
      const matchesProgress =
        !progressFilter ||
        (progressFilter === 'not-started' && ownedCount === 0) ||
        (progressFilter === 'started' && ownedCount > 0 && !isComplete) ||
        (progressFilter === 'complete' && isComplete);

      if (!matchesSeries || !matchesProgress) return false;
      if (!normalizedSearchTerm) return true;

      return (
        set.name.toLowerCase().includes(normalizedSearchTerm) ||
        set.set_code.toLowerCase().includes(normalizedSearchTerm) ||
        seriesName.toLowerCase().includes(normalizedSearchTerm)
      );
    });
  }, [normalizedSearchTerm, progressFilter, selectedSeries, setsPageState.sets, setsProgressState.progressBySetCode]);`, 'sets filtering');
sets = sets.replace('<section className="sets-page" aria-labelledby="sets-page-title">', '<section className="sets-page catalog-page-layout" aria-labelledby="sets-page-title">');
sets = replaceExactly(sets, /      <header className="sets-page-hero">[\s\S]*?        \{isLoading \?/, `      <CatalogPageHeader
        title="Expansions"
        titleId="sets-page-title"
        searchId="sets-page-search-input"
        searchLabel="Expansions zoeken"
        searchPlaceholder="Zoek set, code of uitbreiding..."
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        onSearchClear={() => setSearchTerm('')}
        hasActiveCriteria={Boolean(searchTerm || selectedSeries !== 'all' || progressFilter)}
        onClearAll={() => {
          setSearchTerm('');
          setSelectedSeries('all');
          setProgressFilter('');
        }}
        filters={
          <>
            <CatalogFilterSelect
              ariaLabel="Filter op uitbreiding of serie"
              label="Uitbreiding / serie"
              value={selectedSeries === 'all' ? '' : selectedSeries}
              options={seriesOptions.map((series) => ({ label: series, value: series }))}
              onChange={(value) => setSelectedSeries(value || 'all')}
            />
            <CatalogFilterSelect
              ariaLabel="Filter op voortgang"
              label="Voortgang"
              value={progressFilter}
              options={[
                { label: 'Niet gestart', value: 'not-started' },
                { label: 'Gestart', value: 'started' },
                { label: 'Compleet', value: 'complete' },
              ]}
              onChange={setProgressFilter}
            />
          </>
        }
      />

        {isLoading ?`, 'sets chrome usage');
write('src/features/setsPage/SetsPage.tsx', sets);

let collectionCss = read('src/features/collectionPage/collectionPageV2.css');
const sharedStart = collectionCss.indexOf('.app-shell--child .collection-page--v2 .collection-page-header');
const sharedEnd = collectionCss.indexOf('.app-shell--child .collection-page--v2 > .binder-card-grid');
if (sharedStart < 0 || sharedEnd < 0 || sharedEnd <= sharedStart) throw new Error('collection shared CSS range not found');
collectionCss = collectionCss.slice(0, sharedStart) + '/* Shared header and toolbar styles live in components/catalogPage/catalogPageHeader.css. */\n\n' + collectionCss.slice(sharedEnd);
write('src/features/collectionPage/collectionPageV2.css', collectionCss);

const setsCss = `/* Expansions overview content. Shared header and toolbar styles live in catalogPageHeader.css. */
.app-shell:has(.sets-page) { width:min(100%,1480px); min-height:100vh; padding:10px 12px 28px; color:var(--app-text); background:#030816; }
.app-shell:has(.sets-page) .app-header,.app-shell:has(.sets-page) .top-nav { border-color:var(--app-border); background:rgb(7 20 42 / .86); color:var(--app-text); backdrop-filter:blur(16px); }
.app-shell:has(.sets-page) .top-nav a[aria-current='page'] { color:var(--app-accent); box-shadow:inset 0 -2px 0 var(--app-accent); }
.sets-page { display:grid; gap:10px; width:100%; max-width:var(--app-content-width); min-width:0; margin:0 auto; padding:4px 0 calc(116px + env(safe-area-inset-bottom)); color:var(--app-text); overflow-x:clip; }
.sets-page-card { display:grid; gap:10px; min-width:0; border:0; padding:0 10px; background:transparent; box-shadow:none; }
.sets-page-card>h3,.sets-page-summary,.sets-page-progress-note { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; }
.sets-page-series-list,.sets-page-series-group { display:grid; gap:10px; min-width:0; }
.sets-page-series-group { margin-top:14px; }
.sets-page-series-heading { margin:0 2px 2px; color:var(--app-text); font-size:.88rem; font-weight:900; letter-spacing:.055em; text-transform:uppercase; }
.sets-page-catalog-grid { display:grid; gap:10px; margin:0; padding:0; list-style:none; }
.sets-page-set-card { min-width:0; margin:0; border:0; border-radius:0; background:transparent; box-shadow:none; }
.sets-page-set-summary-button { display:grid; grid-template-columns:102px minmax(0,1fr) 22px; gap:12px; align-items:center; width:100%; min-height:92px; border:0; border-radius:0; padding:6px 0; background:transparent; color:inherit; text-align:left; box-shadow:none; }
.sets-page-set-summary-button::after { content:'›'; grid-column:3; grid-row:1; align-self:center; color:var(--app-text-muted); font-size:1.9rem; line-height:1; }
.sets-page-set-media { display:grid; grid-column:1; grid-row:1; width:102px; height:78px; place-items:center; border:0; border-radius:0; background:transparent; overflow:hidden; }
.sets-page-set-media img { width:92px; height:58px; object-fit:contain; }
.sets-page-set-media-placeholder { color:var(--app-text-muted); font-size:.68rem; text-align:center; }
.sets-page-set-content { display:grid; grid-column:2; grid-row:1; gap:8px; min-width:0; }
.sets-page-set-heading { display:flex; align-items:baseline; gap:9px; min-width:0; }
.sets-page-set-name { min-width:0; overflow:hidden; color:var(--app-text); font-size:1rem; font-weight:850; line-height:1.15; text-overflow:ellipsis; white-space:nowrap; }
.sets-page-set-code { flex:0 0 auto; color:var(--app-text-muted); font-size:.66rem; font-weight:850; letter-spacing:.07em; text-transform:uppercase; }
.sets-page-set-progress { display:grid; grid-template-columns:auto minmax(70px,1fr); gap:10px; align-items:center; min-width:0; color:var(--app-text-muted); font-size:.76rem; font-weight:750; }
.sets-page-set-progress-bar { display:block; height:6px; border-radius:999px; background:rgb(74 127 235 / .18); overflow:hidden; }
.sets-page-set-progress-bar>span { display:block; height:100%; border-radius:inherit; background:linear-gradient(90deg,var(--app-accent),#65a7ff); box-shadow:0 0 10px rgb(0 200 255 / .22); }
.sets-page-set-summary-button:hover,.sets-page-set-summary-button:focus-visible,.sets-page-set-card.is-open .sets-page-set-summary-button { background:rgb(255 255 255 / .025); outline:none; }
@media (max-width:420px) { .sets-page-set-summary-button { grid-template-columns:92px minmax(0,1fr) 18px; gap:9px; } .sets-page-set-media { width:92px; } .sets-page-set-media img { width:84px; } .sets-page-set-progress { grid-template-columns:auto minmax(56px,1fr); gap:7px; } }
`;
write('src/features/setsPage/setsPageV2.css', setsCss);

let main = read('src/main.tsx');
if (!main.includes("./components/catalogPage/catalogPageHeader.css")) {
  main = main.replace("import './ui/app-foundation-compat.css';\n", "import './ui/app-foundation-compat.css';\nimport './components/catalogPage/catalogPageHeader.css';\n");
}
write('src/main.tsx', main);
