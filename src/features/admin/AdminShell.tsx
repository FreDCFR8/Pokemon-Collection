import { useEffect, useState } from 'react';
import { AdminProfilesPanel } from '../profileSettings/AdminProfilesPanel';
import { AdminDashboard } from '../dashboard';
import './adminShell.css';

const adminNavigationItems = [
  { label: 'Overzicht', slug: 'admin' },
  { label: 'Gebruikers en profielen', slug: 'admin-users' },
  { label: 'Instellingen', slug: 'admin-settings' },
  { label: 'Activiteiten', slug: 'admin-activities' },
  { label: 'Applicatiestatus', slug: 'admin-status' },
] as const;

type AdminNavigationItem = (typeof adminNavigationItems)[number];
function getActiveAdminItem(): AdminNavigationItem {
  const slug = window.location.hash.replace('#', '').toLowerCase();
  return adminNavigationItems.find((item) => item.slug === slug) ?? adminNavigationItems[0];
}

const pageCopy: Record<AdminNavigationItem['slug'], { title: string; description: string }> = {
  admin: { title: 'Overzicht', description: 'Bekijk de belangrijkste verzamelingstotalen van Lars en Lore.' },
  'admin-users': { title: 'Gebruikers en profielen', description: 'Bekijk de kinderprofielen en wijzig uitsluitend hun veilige weergavenaam.' },
  'admin-settings': { title: 'Instellingen', description: 'Brede applicatie-instellingen blijven buiten deze fase.' },
  'admin-activities': { title: 'Activiteiten', description: 'De activiteitengeschiedenis volgt pas na het logging- en privacycontract.' },
  'admin-status': { title: 'Applicatiestatus', description: 'Veilige operationele statusinformatie wordt later afzonderlijk toegevoegd.' },
};

export function AdminShell({ displayName, isSigningOut, onSignOut }: { displayName: string; isSigningOut: boolean; onSignOut: () => void }) {
  const [activeItem, setActiveItem] = useState(getActiveAdminItem);
  useEffect(() => {
    const syncItem = () => setActiveItem(getActiveAdminItem());
    window.addEventListener('hashchange', syncItem);
    syncItem();
    return () => window.removeEventListener('hashchange', syncItem);
  }, []);
  const copy = pageCopy[activeItem.slug];

  return (
    <main className="admin-shell">
      <header className="admin-header"><div><p className="admin-eyebrow">Administrator</p><h1>Pokémon Collection</h1><p className="admin-welcome">Aangemeld als {displayName}</p></div><button type="button" onClick={onSignOut} disabled={isSigningOut}>{isSigningOut ? 'Uitloggen…' : 'Uitloggen'}</button></header>
      <nav className="admin-navigation" aria-label="Beheernavigatie">{adminNavigationItems.map((item) => <a href={`#${item.slug}`} key={item.slug} aria-current={activeItem.slug === item.slug ? 'page' : undefined}>{item.label}</a>)}</nav>
      <section className="admin-content" aria-labelledby="admin-page-title">
        <p className="admin-section-label">Beveiligde beheeromgeving</p><h2 id="admin-page-title">{copy.title}</h2><p>{copy.description}</p>
        {activeItem.slug === 'admin' ? <AdminDashboard /> : activeItem.slug === 'admin-users' ? <AdminProfilesPanel /> : <div className="admin-scope-note"><strong>Beperkte fasescope</strong><span>Er zijn geen account-, rol-, database- of importacties beschikbaar.</span></div>}
      </section>
    </main>
  );
}
