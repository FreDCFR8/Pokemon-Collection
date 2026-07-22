import { useEffect, useState } from 'react';
import { LoginPanel, useIdentity } from './features/auth';
import { AdminShell } from './features/admin/AdminShell';
import { CollectionPage } from './features/collectionPage';
import { SetsPage } from './features/setsPage';
import { WishlistPage } from './features/wishlistPage';
import { CatalogSearchPage } from './features/catalogSearch';

const navigationItems = [
  { label: 'Dashboard', slug: 'dashboard' },
  { label: 'Collection', slug: 'collection' },
  { label: 'Sets', slug: 'sets' },
  { label: 'Wishlist', slug: 'wishlist' },
  { label: 'Zoeken', slug: 'search' },
  { label: 'Pokédex', slug: 'pokedex' },
] as const;

type NavigationItem = (typeof navigationItems)[number];
type NavigationLabel = NavigationItem['label'];

const defaultNavigationItem = navigationItems[0];
const legacyPokedexSlugs = new Set(['pokédex', 'pok%C3%A9dex']);

function safelyDecodeHash(hash: string): string {
  try {
    return decodeURIComponent(hash);
  } catch {
    return hash;
  }
}

function getActiveNavigationItem(): NavigationItem {
  const rawHash = window.location.hash.replace('#', '');
  const decodedHash = safelyDecodeHash(rawHash);
  const normalizedHash = decodedHash.toLowerCase();

  if (legacyPokedexSlugs.has(rawHash) || legacyPokedexSlugs.has(normalizedHash)) {
    return navigationItems.find((item) => item.slug === 'pokedex') ?? defaultNavigationItem;
  }

  return navigationItems.find((item) => item.slug === normalizedHash) ?? defaultNavigationItem;
}

function PlaceholderCard({ title, description }: { title: string; description: string }) {
  return (
    <section className="placeholder-card" aria-labelledby={`${title}-title`}>
      <h2 id={`${title}-title`}>{title}</h2>
      <p>{description}</p>
    </section>
  );
}

function DashboardPage() {
  return (
    <section className="hero-panel"><p className="eyebrow">Mijn verzameling</p><h2>Klaar om kaarten te ontdekken?</h2><p>Gebruik de navigatie om je collectie, wishlist en favoriete sets te bekijken.</p></section>
  );
}

function MainContent({ activeNavigationItem }: { activeNavigationItem: NavigationLabel }) {
  switch (activeNavigationItem) {
    case 'Dashboard':
      return <DashboardPage />;
    case 'Collection':
      return <CollectionPage />;
    case 'Sets':
      return <SetsPage />;
    case 'Wishlist':
      return <WishlistPage />;
    case 'Zoeken':
      return <CatalogSearchPage />;
    case 'Pokédex':
      return (
        <section className="placeholder-grid" aria-label="Pokédex scherm">
          <PlaceholderCard title="Pokédex" description="Placeholder voor toekomstige Pokédex-functionaliteit." />
        </section>
      );
    default:
      return <DashboardPage />;
  }
}

export function App() {
  const [activeNavigationItem, setActiveNavigationItem] = useState(getActiveNavigationItem);
  const identity = useIdentity();

  useEffect(() => {
    const syncActiveNavigationItem = () => {
      setActiveNavigationItem(getActiveNavigationItem());
    };

    window.addEventListener('hashchange', syncActiveNavigationItem);
    syncActiveNavigationItem();

    return () => {
      window.removeEventListener('hashchange', syncActiveNavigationItem);
    };
  }, []);

  if (identity.status === 'initializing' || identity.status === 'authenticated_profile_loading') {
    return <main className="app-shell"><section className="identity-state" aria-live="polite"><h1>Pokémon Collection</h1><p>{identity.message}</p></section></main>;
  }
  if (identity.status === 'signed_out') {
    return <main className="app-shell"><header className="app-header"><div><p className="eyebrow">Pokémon Collection</p><h1>Jouw kaarten, jouw avontuur</h1></div></header><LoginPanel /></main>;
  }
  if (identity.status === 'authenticated_profile_missing' || identity.status === 'error') {
    return <main className="app-shell"><section className="identity-state" role="alert"><h1>{identity.status === 'error' ? 'Dat ging niet goed' : 'Profiel niet gevonden'}</h1><p>{identity.message}</p><button type="button" onClick={() => void identity.retry()}>Opnieuw proberen</button><button type="button" onClick={() => void identity.signOut()}>Uitloggen</button></section></main>;
  }

  if (identity.profile?.role === 'admin') {
    return (
      <AdminShell
        displayName={identity.profile.displayName}
        isSigningOut={identity.isSigningOut}
        onSignOut={() => void identity.signOut()}
      />
    );
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Verzameling van {identity.profile?.displayName}</p>
          <h1>Pokémon Collection</h1>
        </div>
        <button className="account-button" type="button" onClick={() => void identity.signOut()} disabled={identity.isSigningOut}>
          {identity.isSigningOut ? 'Uitloggen…' : 'Uitloggen'}
        </button>
      </header>

      <nav className="top-nav" aria-label="Hoofdnavigatie">
        {navigationItems.map((item) => (
          <a
            href={`#${item.slug}`}
            key={item.slug}
            aria-current={activeNavigationItem.slug === item.slug ? 'page' : undefined}
          >
            {item.label}
          </a>
        ))}
      </nav>

      <MainContent activeNavigationItem={activeNavigationItem.label} />
    </main>
  );
}
