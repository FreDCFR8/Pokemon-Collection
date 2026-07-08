import { useEffect, useState } from 'react';
import { AuthStateCard, LoginPanel } from './features/auth';
import { EnvConfigStatusCard } from './features/config';
import { CollectionReadinessCard } from './features/collections';
import { CollectionCardsPreviewCard } from './features/collectionCards';
import { CollectionPage } from './features/collectionPage';
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
          <p className="eyebrow">Phase 3A</p>
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

      {activeNavigationItem === 'Collection' ? (
        <CollectionPage />
      ) : (
        <section className="placeholder-grid" aria-label="Lege hoofdschermen">
          {activeNavigationItem === 'Dashboard' ? (
            <PlaceholderCard title="Dashboard" description="Placeholder voor het toekomstige overzicht." />
          ) : null}
          {activeNavigationItem === 'Sets' ? (
            <PlaceholderCard title="Sets" description="Placeholder voor setnavigatie en setoverzicht." />
          ) : null}
          {activeNavigationItem === 'Wishlist' ? (
            <PlaceholderCard title="Wishlist" description="Placeholder voor toekomstige wishlist-functionaliteit." />
          ) : null}
          {activeNavigationItem === 'Pokédex' ? (
            <PlaceholderCard title="Pokédex" description="Placeholder voor toekomstige Pokédex-functionaliteit." />
          ) : null}
        </section>
      )}
    </main>
  );
}
