import type { CSSProperties } from 'react';
import type { DashboardRecentSet, DashboardSetInsight, DashboardSummary } from './dashboardTypes';

const number = new Intl.NumberFormat('nl-BE');
const date = new Intl.DateTimeFormat('nl-BE', { day: 'numeric', month: 'short', year: 'numeric' });

export function DashboardHero({ displayName }: { displayName: string }) {
  return <section className="dashboard-v2-hero" aria-labelledby="dashboard-welcome"><div className="dashboard-v2-hero__cosmos" aria-hidden="true" /><div className="dashboard-v2-avatar" aria-hidden="true">{displayName.trim().charAt(0).toUpperCase()}</div><div className="dashboard-v2-hero__copy"><p>Jouw persoonlijke collectie</p><h1 id="dashboard-welcome">Hallo {displayName}!</h1><span>Klaar om je collectie verder uit te breiden?</span></div><div className="dashboard-v2-hero__cards" aria-hidden="true"><i /><i /><i /></div></section>;
}

const metrics = (summary: DashboardSummary) => [
  ['Kaarten totaal', summary.totalQuantity, 'cards'],
  ['Unieke kaarten', summary.uniqueOwnedCards, 'unique'],
  ['Wishlist', summary.wishlistCards, 'wishlist'],
  ['Dubbels', summary.duplicateQuantity, 'duplicates'],
] as const;

export function DashboardStatsBand({ summary }: { summary: DashboardSummary }) {
  return <section className="dashboard-v2-stats" aria-label="Collectiestatistieken">{metrics(summary).map(([label, value, tone]) => <div className={`dashboard-v2-stat dashboard-v2-stat--${tone}`} key={label}><span aria-hidden="true">✦</span><strong>{number.format(value)}</strong><small>{label}</small></div>)}</section>;
}

export function DashboardRecentCards({ summary }: { summary: DashboardSummary }) {
  return <section className="dashboard-v2-section" aria-labelledby="recent-cards"><div className="dashboard-v2-section__heading"><h2 id="recent-cards">Recent toegevoegd</h2><a href="#collection">Bekijk collectie <span aria-hidden="true">→</span></a></div>{summary.recentCards.length ? <div className="dashboard-v2-recent-cards">{summary.recentCards.map((card, index) => <article key={`${summary.collectionId}-${card.id}`} className="dashboard-v2-card"><div className="dashboard-v2-card__image">{card.imageSmall ? <img src={card.imageSmall} alt={`Kaart van ${card.pokemon}`} loading={index === 0 ? 'eager' : 'lazy'} /> : <span aria-hidden="true">?</span>}</div><strong>{card.pokemon}</strong><span>{card.setName ?? 'Onbekende set'}{card.number ? ` · ${card.number}` : ''}</span><small>Toegevoegd {date.format(new Date(`${card.addedAt}T00:00:00`))}</small></article>)}</div> : <p className="dashboard-v2-empty">Nog geen kaarten toegevoegd.</p>}</section>;
}

function DashboardProgress({ insight }: { insight: DashboardSetInsight }) {
  return <div className="dashboard-v2-progress"><div><strong>{insight.setName}</strong><span>{insight.progressPercent}%</span></div><div className="dashboard-v2-progress__track" role="progressbar" aria-label={`${insight.setName}: ${insight.ownedCount} van ${insight.total} kaarten`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={insight.progressPercent}><i style={{ width: `${insight.progressPercent}%` }} /></div><small>{insight.ownedCount} van {insight.total} · nog {insight.missingCount}</small></div>;
}

function rarityGradient(summary: DashboardSummary): string {
  const colors = ['#00c8ff', '#20d67b', '#7c3cff', '#ffb31f'];
  let current = 0;
  const segments = summary.rarityInsights.map((insight, index) => { const end = Math.min(100, current + insight.percent); const segment = `${colors[index]} ${current}% ${end}%`; current = end; return segment; });
  return `conic-gradient(${[...segments, `#132544 ${current}% 100%`].join(', ')})`;
}

export function DashboardInsights({ summary }: { summary: DashboardSummary }) {
  const ringStyle = { '--dashboard-ring': rarityGradient(summary) } as CSSProperties;
  return <section className="dashboard-v2-insights" aria-label="Collectie-inzichten"><article className="dashboard-v2-panel"><div className="dashboard-v2-panel__heading"><h2>Voortgang per set</h2><a href="#sets">Alle sets →</a></div>{summary.setInsights.length ? <div className="dashboard-v2-progress-list">{summary.setInsights.map((insight) => <DashboardProgress key={insight.setCode} insight={insight} />)}</div> : <p className="dashboard-v2-empty">Nog geen setvoortgang beschikbaar.</p>}</article><article className="dashboard-v2-panel"><h2>Rarityverdeling</h2>{summary.rarityInsights.length ? <div className="dashboard-v2-chart"><div className="dashboard-v2-ring" style={ringStyle} aria-hidden="true"><span>{number.format(summary.uniqueOwnedCards)}<small>uniek</small></span></div><ul>{summary.rarityInsights.map((insight) => <li key={insight.rarity}><i aria-hidden="true" /><span>{insight.rarity}</span><strong>{number.format(insight.uniqueCards)} ({insight.percent}%)</strong></li>)}</ul></div> : <p className="dashboard-v2-empty">Nog geen raritygegevens beschikbaar.</p>}</article><article className="dashboard-v2-panel"><h2>Uniek vs. dubbels</h2><div className="dashboard-v2-chart dashboard-v2-chart--duplicates"><div className="dashboard-v2-ring dashboard-v2-ring--duplicates" style={{ '--dashboard-duplicate': `${summary.duplicatePercent}%` } as CSSProperties} aria-hidden="true"><span>{number.format(summary.uniqueOwnedCards + summary.duplicateQuantity)}<small>kaarten</small></span></div><ul><li><i className="is-unique" aria-hidden="true" /><span>Unieke kaarten</span><strong>{number.format(summary.uniqueOwnedCards)}</strong></li><li><i className="is-duplicate" aria-hidden="true" /><span>Dubbels</span><strong>{number.format(summary.duplicateQuantity)} ({summary.duplicatePercent}%)</strong></li></ul></div></article></section>;
}

function RecentSetTile({ set }: { set: DashboardRecentSet }) {
  const artwork = set.logoUrl ?? set.symbolUrl;
  return <a className="dashboard-v2-set" href="#sets"><div>{artwork ? <img src={artwork} alt="" /> : <span aria-hidden="true">{set.name.charAt(0)}</span>}</div><strong>{set.name}</strong><small>{set.releaseDate ? date.format(new Date(`${set.releaseDate}T00:00:00`)) : 'Releasedatum onbekend'}</small>{set.progressPercent !== null && set.ownedCount !== null && set.total !== null ? <><span>{set.ownedCount} van {set.total}</span><i role="progressbar" aria-label={`${set.name}: ${set.ownedCount} van ${set.total} kaarten`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={set.progressPercent}><b style={{ width: `${set.progressPercent}%` }} /></i></> : null}</a>;
}

export function DashboardRecentSets({ summary }: { summary: DashboardSummary }) {
  if (summary.recentSetsStatus === 'unavailable') return <section className="dashboard-v2-section dashboard-v2-sets-section" aria-labelledby="recent-sets"><div className="dashboard-v2-section__heading"><h2 id="recent-sets">Recentste sets</h2><a href="#sets">Bekijk alle sets →</a></div><p className="dashboard-v2-empty">Recente sets zijn tijdelijk niet beschikbaar.</p></section>;
  return <section className="dashboard-v2-section dashboard-v2-sets-section" aria-labelledby="recent-sets"><div className="dashboard-v2-section__heading"><h2 id="recent-sets">Recentste sets</h2><a href="#sets">Bekijk alle sets →</a></div>{summary.recentSets.length ? <div className="dashboard-v2-sets">{summary.recentSets.map((set) => <RecentSetTile key={set.setCode} set={set} />)}</div> : <p className="dashboard-v2-empty">Nog geen recente sets beschikbaar.</p>}</section>;
}
