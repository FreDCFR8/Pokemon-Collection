import type { Profile } from './profileTypes';

const plannedProfiles: Profile[] = [
  {
    id: 'planned-parent-admin',
    authUserId: 'planned-auth-parent-admin',
    displayName: 'Parent/Admin',
    role: 'admin',
    createdAt: 'planned',
    updatedAt: 'planned',
  },
  {
    id: 'planned-lars',
    authUserId: 'planned-auth-lars',
    displayName: 'Lars',
    role: 'child',
    createdAt: 'planned',
    updatedAt: 'planned',
  },
  {
    id: 'planned-lore',
    authUserId: 'planned-auth-lore',
    displayName: 'Lore',
    role: 'child',
    createdAt: 'planned',
    updatedAt: 'planned',
  },
];

export function ProfileStatusCard() {
  return (
    <section className="profile-status-card" aria-labelledby="profile-status-title">
      <p className="eyebrow">Phase 2 planning</p>
      <h2 id="profile-status-title">Geplande profielen</h2>
      <p>
        Deze kaart toont alleen lokale placeholder-data. Er is nog geen login, geen Supabase-connectie
        en geen toegang tot echte collectiegegevens.
      </p>
      <ul className="profile-list">
        {plannedProfiles.map((profile) => (
          <li key={profile.id}>
            <span>{profile.displayName}</span>
            <strong>{profile.role === 'admin' ? 'Parent/admin' : 'Child'}</strong>
          </li>
        ))}
      </ul>
    </section>
  );
}
