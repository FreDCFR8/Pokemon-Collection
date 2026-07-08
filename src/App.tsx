import { useEffect, useState } from 'react';
import { AuthStateCard, LoginPanel } from './features/auth';
import { CollectionCardsPreviewCard } from './features/collectionCards';
import { CollectionPage } from './features/collectionPage';
import { CollectionReadinessCard } from './features/collections';
import { EnvConfigStatusCard } from './features/config';
import { ProfileReadinessCard, ProfileStatusCard } from './features/profiles';

const navigationItems = [
  'Dashboard',
  'Collection',
  'Sets',
  'Wishlist',
  'Pokédex',
];

function toNavigationHash(item: string): string {
  return item.toLowerCase();
}

function getActiveNavigationItem(): string {
  const hash = window.location.hash.replace('#', '');
  return navigationItems.find((item) => toNavigationHash(item) === hash) ?? 'Dashboard';
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

function MainContent({ activeNavigationItem }: { activeNavigationItem: string }) {
  switch (activeNavigationItem) {
    case 'Dashboard':
      return <DashboardPage />;
    case 'Collection':
      return <CollectionPage />;
    case 'Sets':
      return (
        <section className="placeholder-grid" aria-label="Sets scherm">
          <PlaceholderCard title="Sets" description="Placeholder voor setnavigatie en setoverzicht." />
        </section>
      );
    case 'Wishlist':
      return (
        <section className="placeholder-grid" aria-label="Wishlist scherm">
          <PlaceholderCard title="Wishlist" description="Placeholder voor toekomstige wishlist-functionaliteit." />
        </section>
      );
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
            href={`#${toNavigationHash(item)}`}
            key={item}
            aria-current={activeNavigationItem === item ? 'page' : undefined}
          >
            {item}
          </a>
        ))}
      </nav>

      <MainContent activeNavigationItem={activeNavigationItem} />
    </main>
  );
}
