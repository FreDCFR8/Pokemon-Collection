import { useEffect, useState } from 'react';
import { ButtonLink } from '../../ui/ButtonLink';
import { StatTile } from '../../ui/StatTile';
import { loadAdminDashboard, loadChildDashboard } from './dashboardService';
import type { DashboardComparison, DashboardSetInsight, DashboardState, DashboardSummary } from './dashboardTypes';
import './dashboard.css';

const loadingState: DashboardState = {
  status: 'loading',
  message: 'Dashboard wordt geladen…',
  summaries: [],
  comparison: null,
};

function StatCard({ label, value }: { label: string; value: number }) {
  return <StatTile className="dashboard-stat" label={label} value={value.toLocaleString('nl-BE')} />;
}

function ProfileMark({ name, compact = false }: { name: string; compact?: boolean }) {
  return (
    <div className={`dashboard-profile-mark${compact ? ' dashboard-profile-mark--compact' : ''}`} aria-hidden="true">
      {name.trim().charAt(0).toUpperCase()}
    </div>
  );
}

function ProgressItem({ insight }: { insight: DashboardSetInsight }) {
  return (
    <article className="dashboard-progress-item">
      <div className="dashboard-progress-copy">
        <div className="dashboard-progress-heading">
          <strong>{insight.setName}</strong>
          <span>{insight.progressPercent}%</span>
        </div>
        <div
          className="dashboard-progress-track"
          role="progressbar"
          aria-label={`${insight.setName}: ${insight.progressPercent}% verzameld`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={insight.progressPercent}
        >
          <span style={{ width: `${insight.progressPercent}%` }} />
        </div>
        <small>{insight.ownedCount} van {insight.total} kaarten · nog {insight.missingCount}</small>
      </div>
    </article>
  );
}

function RecentCards({ summary }: { summary: DashboardSummary }) {
  if (summary.recentCards.length === 0) {
    return <p className="dashboard-empty">Nog geen kaarten toegevoegd.</p>;
  }

  return (
    <div className="dashboard-recent-grid">
      {summary.recentCards.map((card) => (
        <article className="dashboard-recent-card" key={`${summary.collectionId}-${card.id}`}>
          <div className="dashboard-recent-image">
            {card.imageSmall ? (
              <img src={card.imageSmall} alt={`Kaart van ${card.pokemon}`} loading="lazy" />
            ) : (
              <div className="dashboard-card-placeholder" aria-hidden="true">🃏</div>
            )}
          </div>
          <div className="dashboard-recent-copy">
            <strong>{card.pokemon}</strong>
            <span>{card.setName ?? 'Onbekende set'}{card.number ? ` · ${card.number}` : ''}</span>
            <small>Toegevoegd op {new Intl.DateTimeFormat('nl-BE').format(new Date(`${card.addedAt}T00:00:00`))}</small>
          </div>
        </article>
      ))}
    </div>
  );
}

function RaritySummary({ summary }: { summary: DashboardSummary }) {
  if (summary.rarityInsights.length === 0) {
    return <p className="dashboard-empty">Nog geen raritygegevens beschikbaar.</p>;
  }

  return (
    <div className="dashboard-rarity-list">
      {summary.rarityInsights.map((insight) => (
        <article key={insight.rarity}>
          <strong>{insight.uniqueCards}</strong>
          <span>{insight.rarity}</span>
        </article>
      ))}
    </div>
  );
}

function ChildInsights({ summary }: { summary: DashboardSummary }) {
  return (
    <div className="dashboard-insights">
      <section className="dashboard-content-card">
        <div className="dashboard-section-heading">
          <div><span>Jouw sets</span><h4>Setvoortgang</h4></div>
          <a href="#sets">Alle sets</a>
        </div>
        {summary.setInsights.length ? (
          <div className="dashboard-progress-list">
            {summary.setInsights.map((insight) => <ProgressItem key={insight.setCode} insight={insight} />)}
          </div>
        ) : (
          <p className="dashboard-empty">Nog geen setvoortgang beschikbaar.</p>
        )}
      </section>

      <section className="dashboard-content-card">
        <div className="dashboard-section-heading">
          <div><span>Verdeling</span><h4>Rarity-overzicht</h4></div>
        </div>
        <RaritySummary summary={summary} />
      </section>

      {summary.continueCollecting ? (
        <section className="dashboard-continue">
          <div className="dashboard-continue-emblem" aria-hidden="true">✦</div>
          <div>
            <span>Verder verzamelen</span>
            <h4>{summary.continueCollecting.setName}</h4>
            <p>Nog {summary.continueCollecting.missingCount} kaarten tot de volledige set.</p>
          </div>
          <ButtonLink href="#sets" variant="secondary">Open deze set</ButtonLink>
        </section>
      ) : null}
    </div>
  );
}

function Summary({ summary, showInsights = true }: { summary: DashboardSummary; showInsights?: boolean }) {
  return (
    <section className={`dashboard-summary${showInsights ? '' : ' dashboard-summary--admin'}`} aria-labelledby={`dashboard-${summary.profileId}`}>
      <div className="dashboard-summary-heading">
        <div className="dashboard-summary-identity">
          {!showInsights ? <ProfileMark name={summary.displayName} compact /> : null}
          <div>
            <span>{showInsights ? 'Mijn verzameling' : 'Persoonlijk overzicht'}</span>
            <h3 id={`dashboard-${summary.profileId}`}>{summary.displayName}</h3>
          </div>
        </div>
        {showInsights ? null : <a href="#admin-users">Profiel beheren</a>}
      </div>

      <div className="dashboard-stats">
        <StatCard label="Kaarten totaal" value={summary.totalQuantity} />
        <StatCard label="Unieke kaarten" value={summary.uniqueOwnedCards} />
        <StatCard label="Wishlist" value={summary.wishlistCards} />
        <StatCard label="Dubbels" value={summary.duplicateQuantity} />
      </div>

      {showInsights ? (
        <>
          <section className="dashboard-content-card dashboard-recent-section">
            <div className="dashboard-section-heading">
              <div><span>Nieuwe aanwinsten</span><h4>Recent toegevoegd</h4></div>
              <a href="#collection">Bekijk collectie</a>
            </div>
            <RecentCards summary={summary} />
          </section>
          <ChildInsights summary={summary} />
        </>
      ) : (
        <div className="dashboard-admin-progress">
          <h4>Grootste setkansen</h4>
          <div className="dashboard-progress-list">
            {summary.setInsights.slice(0, 2).map((insight) => <ProgressItem key={insight.setCode} insight={insight} />)}
          </div>
        </div>
      )}
    </section>
  );
}

function Comparison({ comparison }: { comparison: DashboardComparison }) {
  return (
    <section className="dashboard-comparison">
      <div className="dashboard-comparison-copy">
        <span>Gezinscollectie</span>
        <h2>Lars & Lore samen</h2>
        <p>
          {comparison.leadingCollectorName
            ? `${comparison.leadingCollectorName} heeft momenteel ${comparison.leadingCollectorDifference} unieke kaarten meer.`
            : 'Beide verzamelingen hebben momenteel evenveel unieke kaarten.'}
        </p>
      </div>
      <div className="dashboard-stats dashboard-stats--comparison">
        <StatCard label="Kaarten totaal" value={comparison.combinedQuantity} />
        <StatCard label="Uniek samen" value={comparison.combinedUniqueCards} />
        <StatCard label="Wishlist samen" value={comparison.combinedWishlistCards} />
        <StatCard label="Dubbels samen" value={comparison.combinedDuplicateQuantity} />
      </div>
    </section>
  );
}

export function ChildDashboard({ profileId, displayName, collectionId }: { profileId: string; displayName: string; collectionId: string }) {
  const [state, setState] = useState<DashboardState>(loadingState);

  useEffect(() => {
    let active = true;
    void loadChildDashboard(profileId, displayName, collectionId).then((next) => {
      if (active) setState(next);
    });
    return () => { active = false; };
  }, [profileId, displayName, collectionId]);

  if (state.status === 'loading') return <section className="dashboard-state" aria-live="polite">{state.message}</section>;
  if (state.status === 'error') return <section className="dashboard-state" role="alert"><strong>Dat ging niet goed</strong><span>{state.message}</span></section>;

  const summary = state.summaries[0];
  if (!summary) return <section className="dashboard-state">Je verzameling is nog leeg.</section>;

  return (
    <div className="dashboard-page">
      <section className="dashboard-hero">
        <div className="dashboard-hero-decoration" aria-hidden="true" />
        <div className="dashboard-hero-topline">
          <ProfileMark name={displayName} />
          <span>Persoonlijke collectie</span>
        </div>
        <div className="dashboard-hero-copy">
          <span>Welkom terug</span>
          <h2>Hallo {displayName}!</h2>
          <p>Bekijk je nieuwste kaarten en ga verder met de sets die je aan het verzamelen bent.</p>
        </div>
        <div className="dashboard-actions">
          <ButtonLink href="#collection">Mijn collectie</ButtonLink>
          <ButtonLink href="#wishlist" variant="secondary">Mijn wishlist</ButtonLink>
          <ButtonLink href="#sets" variant="quiet">Sets bekijken</ButtonLink>
          <ButtonLink href="#search" variant="quiet">Kaart zoeken</ButtonLink>
        </div>
      </section>
      <Summary summary={summary} />
    </div>
  );
}

export function AdminDashboard() {
  const [state, setState] = useState<DashboardState>(loadingState);

  useEffect(() => {
    let active = true;
    void loadAdminDashboard().then((next) => {
      if (active) setState(next);
    });
    return () => { active = false; };
  }, []);

  if (state.status === 'loading') return <div className="dashboard-state" aria-live="polite">{state.message}</div>;
  if (state.status === 'error') return <div className="dashboard-state" role="alert"><strong>Dashboard niet beschikbaar</strong><span>{state.message}</span></div>;
  if (state.summaries.length === 0) return <div className="dashboard-state">{state.message}</div>;

  return (
    <div className="admin-dashboard-grid">
      {state.comparison ? <Comparison comparison={state.comparison} /> : null}
      <div className="dashboard-admin-children">
        {state.summaries.map((summary) => <Summary key={summary.profileId} summary={summary} showInsights={false} />)}
      </div>
    </div>
  );
}
