import { useEffect, useState } from 'react';
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
  const rawHash = window.location.hash.replace('#', '');
  const normalizedHash = safelyDecodeHash(rawHash).toLowerCase();
  if (legacyPokedexSlugs.has(rawHash) || legacyPokedexSlugs.has(normalizedHash)) {
    return navigationItems.find((item) => item.slug === 'pokedex') ?? defaultNavigationItem;
  }
  return navigationItems.find((item) => item.slug === normalizedHash) ?? defaultNavigationItem;
}

function PlaceholderCard({ title, description }: { title: string; description: string }) {
  return <section className="placeholder-card" aria-labelledby={`${title}-title`}><h2 id={`${title}-title`}>{title}</h2><p>{description}</p></section>;
}

function MainContent({ activeNavigationItem, profileId, username, displayName, collectionId, onProfileSaved }: { activeNavigationItem: NavigationLabel; profileId: string; username: string; displayName: string; collectionId: string; onProfileSaved: () => void }) {
  switch (activeNavigationItem) {
    case 'Dashboard': return <ChildDashboard profileId={profileId} displayName={displayName} collectionId={collectionId} />;
    case 'Collection': return <CollectionPage />;
    case 'Sets': return <SetsPage />;
    case 'Wishlist': return <WishlistPage />;
    case 'Zoeken': return <CatalogSearchPage />;
    case 'Pokédex': return <section className="placeholder-grid" aria-label="Pokédex scherm"><PlaceholderCard title="Pokédex" description="Placeholder voor toekomstige Pokédex-functionaliteit." /></section>;
    case 'Profiel': return <div className="profile-settings-grid"><ProfileSettingsForm profileId={profileId} username={username} initialDisplayName={displayName} onSaved={onProfileSaved} /></div>;
    default: return <ChildDashboard profileId={profileId} displayName={displayName} collectionId={collectionId} />;
  }
}

export function App() {
  const [activeNavigationItem, setActiveNavigationItem] = useState(getActiveNavigationItem);
  const identity = useIdentity();

  useEffect(() => {
    const sync = () => setActiveNavigationItem(getActiveNavigationItem());
    window.addEventListener('hashchange', sync);
    sync();
    return () => window.removeEventListener('hashchange', sync);
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
    <main className={`app-shell${activeNavigationItem.slug === 'dashboard' ? ' app-shell--dashboard' : ''}`}>
      <header className="app-header"><div><p className="eyebrow">Verzameling van {profile.displayName}</p><h1>Pokémon Collection</h1></div><button className="account-button" type="button" onClick={() => void identity.signOut()} disabled={identity.isSigningOut}>{identity.isSigningOut ? 'Uitloggen…' : 'Uitloggen'}</button></header>
      <nav className="top-nav" aria-label="Hoofdnavigatie">{navigationItems.map((item) => <a href={`#${item.slug}`} key={item.slug} aria-current={activeNavigationItem.slug === item.slug ? 'page' : undefined}>{item.label}</a>)}</nav>
      <MainContent activeNavigationItem={activeNavigationItem.label} profileId={profile.id} username={profile.username} displayName={profile.displayName} collectionId={collection.id} onProfileSaved={() => void identity.retry()} />
    </main>
  );
}
