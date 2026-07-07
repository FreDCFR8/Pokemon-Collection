import { useCallback, useEffect, useState } from 'react';
import { checkProfileReadiness } from './profileReadinessService';
import type { ProfileReadinessState } from './profileReadinessTypes';

const initialProfileReadiness: ProfileReadinessState = {
  status: 'loading',
  message: 'Profielcontrole wordt gestart.',
  profile: null,
};

export function ProfileReadinessCard() {
  const [readiness, setReadiness] = useState<ProfileReadinessState>(initialProfileReadiness);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshProfileReadiness = useCallback(async () => {
    setIsRefreshing(true);
    setReadiness((currentReadiness) => ({
      ...currentReadiness,
      status: 'loading',
      message: 'Profielcontrole wordt uitgevoerd.',
      errorMessage: undefined,
    }));

    const nextReadiness = await checkProfileReadiness();
    setReadiness(nextReadiness);
    setIsRefreshing(false);
  }, []);

  useEffect(() => {
    let isMounted = true;

    setReadiness(initialProfileReadiness);
    checkProfileReadiness().then((nextReadiness) => {
      if (isMounted) {
        setReadiness(nextReadiness);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <section className="profile-readiness-card" aria-labelledby="profile-readiness-title">
      <p className="eyebrow">Profile readiness</p>
      <h2 id="profile-readiness-title">Echte profielcontrole</h2>
      <p>{readiness.message}</p>
      {readiness.errorMessage ? <p className="status-note">Foutmelding: {readiness.errorMessage}</p> : null}

      <dl className="status-list">
        <div>
          <dt>Status</dt>
          <dd>{readiness.status}</dd>
        </div>
        <div>
          <dt>Collectiegegevens</dt>
          <dd>Niet geladen</dd>
        </div>
        <div>
          <dt>Cards table</dt>
          <dd>Niet gebruikt</dd>
        </div>
      </dl>

      {readiness.profile ? (
        <dl className="profile-readiness-details" aria-label="Gevonden profiel">
          <div>
            <dt>Display name</dt>
            <dd>{readiness.profile.displayName}</dd>
          </div>
          <div>
            <dt>Username</dt>
            <dd>{readiness.profile.username}</dd>
          </div>
          <div>
            <dt>Role</dt>
            <dd>{readiness.profile.role}</dd>
          </div>
          <div>
            <dt>Child key</dt>
            <dd>{readiness.profile.childKey ?? 'Niet gekoppeld'}</dd>
          </div>
        </dl>
      ) : null}

      <button className="profile-readiness-refresh" type="button" onClick={refreshProfileReadiness} disabled={isRefreshing}>
        {isRefreshing ? 'Profiel controleren…' : 'Profiel opnieuw controleren'}
      </button>
    </section>
  );
}
