import type { DashboardAction, DashboardContentState } from './dashboardTypes';

const dashboardActions: DashboardAction[] = [
  { href: '#collection', title: 'Mijn collectie', description: 'Bekijk al je verzamelde kaarten.', icon: 'collection' },
  { href: '#wishlist', title: 'Wishlist', description: 'Bekijk de kaarten die je nog zoekt.', icon: 'wishlist' },
  { href: '#sets', title: 'Sets', description: 'Ontdek sets en verzamel verder.', icon: 'sets' },
  { href: '#search', title: 'Zoeken', description: 'Vind een kaart in de catalogus.', icon: 'search' },
];

// Tijdelijke D2-waarde; in een latere fase wordt deze aan het actieve profiel gekoppeld.
const temporaryActiveProfileName = 'Lars';

function DashboardIcon({ name }: { name: DashboardAction['icon'] }) {
  const paths = {
    collection: <><rect x="4" y="6" width="13" height="15" rx="2" /><path d="M8 3h12v15" /></>,
    wishlist: <path d="M12 20.5 4.6 13.6A5.2 5.2 0 0 1 12 6.2a5.2 5.2 0 0 1 7.4 7.4Z" />,
    sets: <><path d="m12 3 8 4.5-8 4.5-8-4.5Z" /><path d="m4 12 8 4.5 8-4.5M4 16.5l8 4.5 8-4.5" /></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
  };

  return <svg className="dashboard-action-icon" viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}

function DashboardPlaceholder({ state, emptyText }: { state: DashboardContentState; emptyText: string }) {
  switch (state) {
    case 'loading':
      return <div className="dashboard-placeholder dashboard-placeholder-loading" role="status">Bezig met laden…</div>;
    case 'empty':
      return <div className="dashboard-placeholder"><span aria-hidden="true">◇</span><p>{emptyText}</p></div>;
    case 'error':
      return <div className="dashboard-placeholder dashboard-placeholder-error" role="alert">Dit onderdeel kon niet worden geladen.</div>;
  }
}

export function DashboardPage({
  profileName = temporaryActiveProfileName,
  recentState = 'empty',
  collectingState = 'empty',
}: {
  profileName?: string;
  recentState?: DashboardContentState;
  collectingState?: DashboardContentState;
}) {
  return (
    <div className="dashboard-shell">
      <section className="dashboard-hero" aria-labelledby="dashboard-greeting">
        <div>
          <p className="dashboard-kicker">Jouw verzameling</p>
          <h2 id="dashboard-greeting">Hallo {profileName}!</h2>
          <p>Klaar om verder te verzamelen?</p>
        </div>
        <div className="dashboard-avatar" aria-hidden="true">{profileName.slice(0, 1).toUpperCase()}</div>
      </section>

      <nav className="dashboard-actions" aria-label="Snel naar">
        {dashboardActions.map((action) => (
          <a className={`dashboard-action dashboard-action-${action.icon}`} href={action.href} key={action.href}>
            <DashboardIcon name={action.icon} />
            <span><strong>{action.title}</strong><small>{action.description}</small></span>
            <span className="dashboard-action-arrow" aria-hidden="true">→</span>
          </a>
        ))}
      </nav>

      <div className="dashboard-content-grid">
        <section className="dashboard-section" aria-labelledby="recent-title">
          <h2 id="recent-title">Recent toegevoegd</h2>
          <DashboardPlaceholder state={recentState} emptyText="Je recent toegevoegde kaarten verschijnen hier." />
        </section>
        <section className="dashboard-section" aria-labelledby="collecting-title">
          <h2 id="collecting-title">Verder verzamelen</h2>
          <DashboardPlaceholder state={collectingState} emptyText="Sets waarmee je bezig bent verschijnen hier." />
        </section>
      </div>
    </div>
  );
}
