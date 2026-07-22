import { useEffect, useState } from 'react';
import { ProfileSettingsForm } from './ProfileSettingsForm';
import { loadChildProfiles, type ProfileSettingsSummary } from './profileSettingsService';

export function AdminProfilesPanel() {
  const [profiles, setProfiles] = useState<ProfileSettingsSummary[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let active = true;
    void loadChildProfiles()
      .then((rows) => {
        if (!active) return;
        setProfiles(rows);
        setStatus('ready');
      })
      .catch(() => {
        if (active) setStatus('error');
      });
    return () => {
      active = false;
    };
  }, []);

  if (status === 'loading') return <p aria-live="polite">Profielen worden geladen…</p>;
  if (status === 'error') return <p role="alert">De profielen konden niet veilig worden geladen.</p>;

  return (
    <div className="profile-settings-grid">
      {profiles.map((profile) => (
        <ProfileSettingsForm
          key={profile.id}
          profileId={profile.id}
          username={profile.username}
          initialDisplayName={profile.displayName}
          onSaved={(displayName) => setProfiles((current) => current.map((item) => item.id === profile.id ? { ...item, displayName } : item))}
        />
      ))}
    </div>
  );
}
