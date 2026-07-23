import { useEffect, useRef, useState } from 'react';
import { LoginPanel, useIdentity } from './features/auth';
import { AdminShell } from './features/admin/AdminShell';
import { CollectionPage } from './features/collectionPage';
import { SetsPage } from './features/setsPage';
import { WishlistPage } from './features/wishlistPage';
import { CatalogSearchPage } from './features/catalogSearch';
import { ProfileSettingsForm } from './features/profileSettings/ProfileSettingsForm';
import { ChildDashboard } from './features/dashboard';

const navigationItems = [
  { label: 'Dashboard', slug: 'dashboard' },
  { label: 'Collection', slug: 'collection' },
  { label: 'Sets', slug: 'sets' },
  { label: 'Wishlist', slug: 'wishlist' },
  { label: 'Zoeken', slug: 'search' },
  { label: 'Pokédex', slug: 'pokedex' },
  { label: 'Profiel', slug: 'profile' },
] as const;

type NavigationItem = (typeof navigationItems)[number];
type NavigationLabel = NavigationItem['label'];
const defaultNavigationItem = navigationItems[0];
const legacyPokedexSlugs = new Set(['pokédex', 'pok%C3%A9dex']);

function safelyDecodeHash(hash: string): string {
  try { return decodeURIComponent(hash); } catch { return hash; }
}

function getActiveNavigationItem(): NavigationItem {
  const rawHash = window.location.hash.replace('#', '').split('?')[0];
  const normalizedHash = safelyDecodeHash(rawHash).toLowerCase();
  if (legacyPokedexSlugs.has(rawHash) || legacyPokedexSlugs.has(normalizedHash)) {
    return navigationItems.find((item) => item.slug === 'pokedex') ?? defaultNavigationItem;
  }
  return navigationItems.find((item) => item.slug === normalizedHash) ?? defaultNavigationItem;
}

function getRouteParameter(name: string): string | null {
  const query = window.location.hash.split('?')[1];
  return query ? new URLSearchParams(query).get(name) : null;
}

const mobileNavigationItems = [
  { slug: 'dashboard', label: 'Dashboard', icon: '⌂' },
  { slug: 'collection', label: 'Collectie', icon: '▣' },
  { slug: 'sets', label: 'Sets', icon: '◇' },
  { slug: 'pokedex', label: 'Pokédex', icon: '◌' },
  { slug: 'wishlist', label: 'Wishlist', icon: '♡' },
  { slug: 'search', label: 'Zoeken', icon: '⌕' },
] as const;

function MobileBottomNavigation({ activeSlug, isSigningOut, onSignOut }: { activeSlug: string; isSigningOut: boolean; onSignOut: () => void }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function closeOnOutside(event: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setIsMenuOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsMenuOpen(false);
    }
    document.addEventListener('pointerdown', closeOnOutside);
    window.addEventListener('keydown', closeOnEscape);
    return () => { document.removeEventListener('pointerdown', closeOnOutside); window.removeEventListener('keydown', closeOnEscape); };
  }, []);

  return <nav className="mobile-bottom-nav" aria-label="Mobiele hoofdnavigatie"><div className="mobile-bottom-nav__bar">{mobileNavigationItems.map((item) => <a href={`#${item.slug}`} key={item.slug} aria-current={activeSlug === item.slug ? 'page' : undefined} onClick={() => setIsMenuOpen(false)}><span aria-hidden="true">{item.icon}</span><small>{item.label}</small></a>)}<div className="mobile-bottom-nav__menu" ref={menuRef}><button type="button" aria-label="Open menu" aria-expanded={isMenuOpen} onClick={() => setIsMenuOpen((open) => !open)}><span aria-hidden="true">☰</span><small>Menu</small></button>{isMenuOpen ? <div className="mobile-bottom-nav__popover"><a href="#profile" onClick={() => setIsMenuOpen(false)}>Profiel</a><button type="button" onClick={onSignOut} disabled={isSigningOut}>{isSigningOut ? 'Uitloggen…' : 'Uitloggen'}</button></div> : null}</div></div></nav>;
}

function PlaceholderCard({ title, description }: { title: string; description: string }) {
  return <section className="placeholder-card" aria-labelledby={`${title}-title`}><h2 id={`${title}-title`}>{title}</h2><p>{description}</p></section>;
}

function CollectionExperience({ displayName }: { displayName: string }) {
  const experienceRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const toggle = experienceRef.current?.querySelector<HTMLButtonElement>('.collection-page-filter-toggle');
    if (toggle?.getAttribute('aria-expanded') === 'false') {
      toggle.click();
    }
  }, []);

  return (
    <div className="collection-experience" ref={experienceRef}>
      <div className="collection-experience__title" aria-hidden="true">
        <span className="collection-experience__spark">✦</span>
        <strong>Collectie</strong>
        <em>van {displayName}</em>
        <span className="collection-experience__spark collection-experience__spark--end">✦</span>
      </div>
      <CollectionPage />
    </div>
  );
}

function MainContent({ activeNavigationItem, profileId, username, displayName, collectionId, requestedSetCode, requestedCardId, onProfileSaved }: { activeNavigationItem: NavigationLabel; profileId: string; username: string; displayName: string; collectionId: string; requestedSetCode: string | null; requestedCardId: string | null; onProfileSaved: () => void }) {
  switch (activeNavigationItem) {
    case 'Dashboard': return <ChildDashboard profileId={profileId} displayName={displayName} collectionId={collectionId} />;
    case 'Collection': return <CollectionExperience displayName={displayName} />;
    case 'Sets': return <SetsPage requestedSetCode={requestedSetCode} requestedCardId={requestedCardId} />;
    case 'Wishlist': return <WishlistPage />;
    case 'Zoeken': return <CatalogSearchPage />;
    case 'Pokédex': return <section className="placeholder-grid" aria-label="Pokédex scherm"><PlaceholderCard title="Pokédex" description="Placeholder voor toekomstige Pokédex-functionaliteit." /></section>;
    case 'Profiel': return <div className="profile-settings-grid"><ProfileSettingsForm profileId={profileId} username={username} initialDisplayName={displayName} onSaved={onProfileSaved} /></div>;
    default: return <ChildDashboard profileId={profileId} displayName={displayName} collectionId={collectionId} />;
  }
}

export function App() {
  const [activeNavigationItem, setActiveNavigationItem] = useState(getActiveNavigationItem);
  const [isCardDetailOpen, setIsCardDetailOpen] = useState(false);
  const identity = useIdentity();

  useEffect(() => {
    const sync = () => setActiveNavigationItem(getActiveNavigationItem());
    window.addEventListener('hashchange', sync);
    sync();
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  useEffect(() => {
    document.body.classList.toggle('dashboard-active', activeNavigationItem.slug === 'dashboard');
    return () => document.body.classList.remove('dashboard-active');
  }, [activeNavigationItem.slug]);

  useEffect(() => {
    const syncCardDetailState = () => setIsCardDetailOpen(Boolean(document.querySelector('.card-detail-backdrop')));
    const observer = new MutationObserver(syncCardDetailState);
    observer.observe(document.body, { childList: true, subtree: true });
    syncCardDetailState();
    return () => observer.disconnect();
  }, []);

  if (identity.status === 'initializing' || identity.status === 'authenticated_profile_loading') return <main className="app-shell"><section className="identity-state" aria-live="polite"><h1>Pokémon Collection</h1><p>{identity.message}</p></section></main>;
  if (identity.status === 'signed_out') return <main className="app-shell"><header className="app-header"><div><p className="eyebrow">Pokémon Collection</p><h1>Jouw kaarten, jouw avontuur</h1></div></header><LoginPanel /></main>;
  if (identity.status === 'authenticated_profile_missing' || identity.status === 'error') return <main className="app-shell"><section className="identity-state" role="alert"><h1>{identity.status === 'error' ? 'Dat ging niet goed' : 'Profiel niet gevonden'}</h1><p>{identity.message}</p><button type="button" onClick={() => void identity.retry()}>Opnieuw proberen</button><button type="button" onClick={() => void identity.signOut()}>Uitloggen</button></section></main>;

  if (identity.profile?.role === 'admin') {
    return <AdminShell displayName={identity.profile.displayName} isSigningOut={identity.isSigningOut} onSignOut={() => void identity.signOut()} />;
  }

  const profile = identity.profile;
  const collection = identity.mainCollection;
  if (!profile || !collection) return null;

  return (
    <main className={`app-shell app-shell--child${activeNavigationItem.slug === 'dashboard' ? ' app-shell--dashboard' : ''}`}>
      <header className="app-header"><div><p className="eyebrow">Verzameling van {profile.displayName}</p><h1>Pokémon Collection</h1></div><button className="account-button" type="button" onClick={() => void identity.signOut()} disabled={identity.isSigningOut}>{identity.isSigningOut ? 'Uitloggen…' : 'Uitloggen'}</button></header>
      <nav className="top-nav" aria-label="Hoofdnavigatie">{navigationItems.map((item) => <a href={`#${item.slug}`} key={item.slug} aria-current={activeNavigationItem.slug === item.slug ? 'page' : undefined}>{item.label}</a>)}</nav>
      <MainContent activeNavigationItem={activeNavigationItem.label} profileId={profile.id} username={profile.username} displayName={profile.displayName} collectionId={collection.id} requestedSetCode={getRouteParameter('set')} requestedCardId={getRouteParameter('card')} onProfileSaved={() => void identity.retry()} />
      {!isCardDetailOpen ? <MobileBottomNavigation activeSlug={activeNavigationItem.slug} isSigningOut={identity.isSigningOut} onSignOut={() => void identity.signOut()} /> : null}
    </main>
  );
}
