import { useState } from 'react';
import { updateProfileDisplayName, validateDisplayName } from './profileSettingsService';
import './profileSettings.css';

export function ProfileSettingsForm({
  profileId,
  username,
  initialDisplayName,
  onSaved,
}: {
  profileId: string;
  username: string;
  initialDisplayName: string;
  onSaved?: (displayName: string) => void;
}) {
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [message, setMessage] = useState('Je gebruikersnaam en toegang blijven ongewijzigd.');
  const [isSaving, setIsSaving] = useState(false);

  const save = async () => {
    const validationError = validateDisplayName(displayName);
    if (validationError) {
      setMessage(validationError);
      return;
    }
    setIsSaving(true);
    try {
      const savedName = await updateProfileDisplayName(profileId, displayName);
      setDisplayName(savedName);
      setMessage('Weergavenaam opgeslagen.');
      onSaved?.(savedName);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'De wijziging kan nu niet worden opgeslagen.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="profile-settings-card" aria-labelledby={`profile-settings-${profileId}`}>
      <div>
        <p className="profile-settings-label">Profiel</p>
        <h3 id={`profile-settings-${profileId}`}>{initialDisplayName}</h3>
        <p className="profile-settings-username">Gebruikersnaam: {username}</p>
      </div>
      <label>
        Weergavenaam
        <input value={displayName} maxLength={40} onChange={(event) => setDisplayName(event.target.value)} />
      </label>
      <button type="button" onClick={() => void save()} disabled={isSaving || displayName.trim() === initialDisplayName}>
        {isSaving ? 'Opslaan…' : 'Opslaan'}
      </button>
      <p className="profile-settings-message" aria-live="polite">{message}</p>
    </section>
  );
}
