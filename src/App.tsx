import { useEffect, useState } from 'react';
import { AuthStateCard, LoginPanel } from './features/auth';
import { CollectionCardsPreviewCard } from './features/collectionCards';
import { CollectionPage } from './features/collectionPage';
import { CollectionReadinessCard } from './features/collections';
import { EnvConfigStatusCard } from './features/config';
import { ProfileReadinessCard, ProfileStatusCard } from './features/profiles';
import { SetsPage } from './features/setsPage';
import { WishlistPage } from './features/wishlistPage';

const navigationItems = [
  { label: 'Dashboard', slug: 'dashboard' },
  { label: 'Collection', slug: 'collection' },
  { label: 'Sets', slug: 'sets' },
  { label: 'Wishlist', slug: 'wishlist' },
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
    <>
      <section className="hero-panel">
        <p className="eyebrow">Config readiness</p>
        <h2>Configuratie voorbereid zonder data-opvraging</h2>
        <p>
          De app kan nu tonen of de publieke configuratie aanwezig lijkt. De Collection-tab laadt read-only
          collectiekaarten pas wanneer de readiness flow groen is.
        </p>
      </section>

      <EnvConfigStatusCard />
      <section className="auth-layout" aria-label="Authenticatie voorbereiding">
        <AuthStateCard />
        <LoginPanel />
        <ProfileReadinessCard />
        <CollectionReadinessCard />
        <CollectionCardsPreviewCard />
      </section>
      <ProfileStatusCard />

      <section className="placeholder-grid" aria-label="Dashboard planning">
        <PlaceholderCard title="Dashboard" description="Placeholder voor het toekomstige overzicht." />
      </section>
    </>
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

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Phase 3B</p>
          <h1>Pokémon Collection</h1>
        </div>
        <button className="menu-button" type="button" aria-label="Menu openen">
          ☰
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
