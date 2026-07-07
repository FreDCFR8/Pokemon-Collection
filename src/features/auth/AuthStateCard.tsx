import { useEffect, useState } from 'react';
import { checkAuthReadinessSessionStatus } from './authReadinessService';
import { createAuthReadinessState, type AuthReadinessState } from './authReadinessTypes';

export function AuthStateCard() {
  const [readiness, setReadiness] = useState<AuthReadinessState>(() =>
    createAuthReadinessState('loading', { sessionPresent: false }),
  );

  useEffect(() => {
    let isMounted = true;

    checkAuthReadinessSessionStatus().then((nextReadiness) => {
      if (isMounted) {
        setReadiness(nextReadiness);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <section className="auth-state-card" aria-labelledby="auth-state-title">
      <p className="eyebrow">Auth readiness</p>
      <h2 id="auth-state-title">{readiness.title}</h2>
      <p>{readiness.description}</p>
      {readiness.errorMessage ? <p className="status-note">Foutmelding: {readiness.errorMessage}</p> : null}
      <dl className="status-list">
        <div>
          <dt>Supabase auth-check</dt>
          <dd>{readiness.status}</dd>
        </div>
        <div>
          <dt>Sessie</dt>
          <dd>{readiness.sessionPresent ? 'Aanwezig' : 'Niet aanwezig'}</dd>
        </div>
        <div>
          <dt>Profieldata</dt>
          <dd>{readiness.profileDataLoaded ? 'Geladen' : 'Niet geladen'}</dd>
        </div>
        <div>
          <dt>Collectiegegevens</dt>
          <dd>{readiness.collectionDataLoaded ? 'Geladen' : 'Niet geladen'}</dd>
        </div>
      </dl>
    </section>
  );
}
