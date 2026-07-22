import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import type { DashboardContentState } from '../../src/features/dashboard/dashboardTypes.ts';

type DashboardPageProps = {
  profileName?: string;
  recentState?: DashboardContentState;
  collectingState?: DashboardContentState;
};

const vite = await createServer({
  appType: 'custom',
  logLevel: 'silent',
  server: { middlewareMode: true },
});

const dashboardModule = await vite.ssrLoadModule('/src/features/dashboard/DashboardPage.tsx') as {
  DashboardPage: React.ComponentType<DashboardPageProps>;
};
await vite.close();

function renderDashboard(props: DashboardPageProps = {}) {
  return renderToStaticMarkup(React.createElement(dashboardModule.DashboardPage, props));
}

test('dashboard rendert de D2-shell met Lars en alle vereiste onderdelen', () => {
  const output = renderDashboard();

  for (const text of ['Hallo Lars!', 'Mijn collectie', 'Wishlist', 'Sets', 'Zoeken', 'Recent toegevoegd', 'Verder verzamelen']) {
    assert.match(output, new RegExp(text));
  }

  for (const readinessText of ['Config readiness', 'Login UI klaarzetten', 'Echte profielcontrole', 'Echte collectiecontrole', 'Kaarten preview']) {
    assert.doesNotMatch(output, new RegExp(readinessText));
  }
});

test('hoofdtegels krijgen de bestaande hashroutes in de gerenderde output', () => {
  const output = renderDashboard();

  for (const href of ['#collection', '#wishlist', '#sets', '#search']) {
    assert.match(output, new RegExp(`href="${href}"`));
  }
});

test('tijdelijke profielnaam kan via de prop worden overschreven', () => {
  const output = renderDashboard({ profileName: 'Lore' });

  assert.match(output, /Hallo Lore!/);
  assert.doesNotMatch(output, /Hallo Lars!/);
});

test('loading, empty en error worden als afzonderlijke toestanden gerenderd', () => {
  const loadingOutput = renderDashboard({ recentState: 'loading' });
  assert.match(loadingOutput, /Bezig met laden…/);
  assert.doesNotMatch(loadingOutput, /Je recent toegevoegde kaarten verschijnen hier\./);

  const emptyOutput = renderDashboard({ recentState: 'empty' });
  assert.match(emptyOutput, /Je recent toegevoegde kaarten verschijnen hier\./);
  assert.doesNotMatch(emptyOutput, /Bezig met laden…|Dit onderdeel kon niet worden geladen\./);

  const errorOutput = renderDashboard({ recentState: 'error' });
  assert.match(errorOutput, /Dit onderdeel kon niet worden geladen\./);
  assert.doesNotMatch(errorOutput, /Je recent toegevoegde kaarten verschijnen hier\./);
});
