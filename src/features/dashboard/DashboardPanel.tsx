import { useEffect, useState } from 'react';
import { loadAdminDashboard, loadChildDashboard } from './dashboardService';
import type { DashboardState, DashboardSummary } from './dashboardTypes';
import './dashboard.css';

const loadingState: DashboardState = { status: 'loading', message: 'Dashboard wordt geladen…', summaries: [] };

function StatCard({ label, value }: { label: string; value: number }) {
  return <article className="dashboard-stat"><span>{label}</span><strong>{value.toLocaleString('nl-BE')}</strong></article>;
}

function RecentCards({ summary }: { summary: DashboardSummary }) {
  if (summary.recentCards.length === 0) {
    return <p className="dashboard-empty">Nog geen kaarten toegevoegd.</p>;
  }

  return (
    <div className="dashboard-recent-grid">
      {summary.recentCards.map((card) => (
        <article className="dashboard-recent-card" key={`${summary.collectionId}-${card.id}`}>
          {card.imageSmall ? <img src={card.imageSmall} alt="" loading="lazy" /> : <div className="dashboard-card-placeholder" aria-hidden="true">🃏</div>}
          <div><strong>{card.pokemon}</strong><span>{card.setName ?? 'Onbekende set'}{card.number ? ` · ${card.number}` : ''}</span><small>Toegevoegd op {new Intl.DateTimeFormat('nl-BE').format(new Date(`${card.addedAt}T00:00:00`))}</small></div>
        </article>
      ))}
    </div>
  );
}

function Summary({ summary, showRecent = true }: { summary: DashboardSummary; showRecent?: boolean }) {
  return (
    <section className="dashboard-summary" aria-labelledby={`dashboard-${summary.profileId}`}>
      <div className="dashboard-summary-heading"><div><p className="dashboard-kicker">Verzameling</p><h3 id={`dashboard-${summary.profileId}`}>{summary.displayName}</h3></div>{showRecent ? null : <a href="#admin-users">Profiel beheren</a>}</div>
      <div className="dashboard-stats">
        <StatCard label="Kaarten totaal" value={summary.totalQuantity} />
        <StatCard label="Unieke kaarten" value={summary.uniqueOwnedCards} />
        <StatCard label="Wishlist" value={summary.wishlistCards} />
      </div>
      {showRecent ? <><h4>Recent toegevoegd</h4><RecentCards summary={summary} /></> : null}
    </section>
  );
}

export function ChildDashboard({ profileId, displayName, collectionId }: { profileId: string; displayName: string; collectionId: string }) {
  const [state, setState] = useState<DashboardState>(loadingState);
  useEffect(() => { let active = true; void loadChildDashboard(profileId, displayName, collectionId).then((next) => { if (active) setState(next); }); return () => { active = false; }; }, [profileId, displayName, collectionId]);

  if (state.status === 'loading') return <section className="dashboard-state" aria-live="polite">{state.message}</section>;
  if (state.status === 'error') return <section className="dashboard-state" role="alert"><strong>Dat ging niet goed</strong><span>{state.message}</span></section>;
  const summary = state.summaries[0];
  if (!summary) return <section className="dashboard-state">Je verzameling is nog leeg.</section>;

  return (
    <div className="dashboard-page">
      <section className="dashboard-hero"><p className="dashboard-kicker">Welkom terug</p><h2>Hallo {displayName}!</h2><p>Bekijk je verzameling en ga meteen verder waar je zin in hebt.</p><div className="dashboard-actions"><a href="#collection">Mijn collectie</a><a href="#wishlist">Mijn wishlist</a><a href="#sets">Sets bekijken</a><a href="#search">Kaart zoeken</a></div></section>
      <Summary summary={summary} />
    </div>
  );
}

export function AdminDashboard() {
  const [state, setState] = useState<DashboardState>(loadingState);
  useEffect(() => { let active = true; void loadAdminDashboard().then((next) => { if (active) setState(next); }); return () => { active = false; }; }, []);

  if (state.status === 'loading') return <div className="dashboard-state" aria-live="polite">{state.message}</div>;
  if (state.status === 'error') return <div className="dashboard-state" role="alert"><strong>Dashboard niet beschikbaar</strong><span>{state.message}</span></div>;
  if (state.summaries.length === 0) return <div className="dashboard-state">{state.message}</div>;

  return <div className="admin-dashboard-grid">{state.summaries.map((summary) => <Summary key={summary.profileId} summary={summary} showRecent={false} />)}</div>;
}
