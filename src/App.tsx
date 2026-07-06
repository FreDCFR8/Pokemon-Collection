import { ProfileStatusCard } from './features/profiles/ProfileStatusCard';

const navigationItems = [
  'Dashboard',
  'Collection',
  'Sets',
  'Wishlist',
  'Pokédex',
];

function PlaceholderCard({ title, description }: { title: string; description: string }) {
  return (
    <section className="placeholder-card" aria-labelledby={`${title}-title`}>
      <h2 id={`${title}-title`}>{title}</h2>
      <p>{description}</p>
    </section>
  );
}

export function App() {
  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Phase 2</p>
          <h1>Pokémon Collection</h1>
        </div>
        <button className="menu-button" type="button" aria-label="Menu openen">
          ☰
        </button>
      </header>

      <nav className="top-nav" aria-label="Hoofdnavigatie">
        {navigationItems.map((item) => (
          <a href={`#${item.toLowerCase()}`} key={item}>
            {item}
          </a>
        ))}
      </nav>

      <section className="hero-panel">
        <p className="eyebrow">Profile planning only</p>
        <h2>Profielen voorbereid zonder data-integratie</h2>
        <p>
          Deze fase bereidt parent/admin, Lars en Lore voor als gescheiden profielen. Er wordt nog geen
          Supabase-data gelezen, geschreven of gemigreerd.
        </p>
      </section>

      <ProfileStatusCard />

      <section className="placeholder-grid" aria-label="Lege hoofdschermen">
        <PlaceholderCard title="Dashboard" description="Placeholder voor het toekomstige overzicht." />
        <PlaceholderCard title="Collection" description="Placeholder voor de toekomstige collectieviewer." />
        <PlaceholderCard title="Sets" description="Placeholder voor setnavigatie en setoverzicht." />
        <PlaceholderCard title="Wishlist" description="Placeholder voor toekomstige wishlist-functionaliteit." />
        <PlaceholderCard title="Pokédex" description="Placeholder voor toekomstige Pokédex-functionaliteit." />
      </section>
    </main>
  );
}
