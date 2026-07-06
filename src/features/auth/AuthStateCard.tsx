import { phase2AuthStatePlaceholder } from './authStateTypes';

export function AuthStateCard() {
  return (
    <section className="auth-state-card" aria-labelledby="auth-state-title">
      <p className="eyebrow">Auth placeholder</p>
      <h2 id="auth-state-title">{phase2AuthStatePlaceholder.title}</h2>
      <p>{phase2AuthStatePlaceholder.description}</p>
      <dl className="status-list">
        <div>
          <dt>Supabase client</dt>
          <dd>Boundary aanwezig</dd>
        </div>
        <div>
          <dt>Login</dt>
          <dd>Nog niet actief</dd>
        </div>
        <div>
          <dt>Profieldata</dt>
          <dd>Alleen placeholder</dd>
        </div>
      </dl>
    </section>
  );
}
