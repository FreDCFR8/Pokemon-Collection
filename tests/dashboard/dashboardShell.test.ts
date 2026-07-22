import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync('src/App.tsx', 'utf8');
const dashboardSource = readFileSync('src/features/dashboard/DashboardPage.tsx', 'utf8');

test('dashboard bevat de D2-shell en lege secties', () => {
  for (const text of ['Hallo {profileName}!', 'Mijn collectie', 'Wishlist', 'Sets', 'Zoeken', 'Recent toegevoegd', 'Verder verzamelen']) {
    assert.match(dashboardSource, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(dashboardSource, /temporaryActiveProfileName = 'Lars'/);
});

test('dashboard rendert geen oude readinesscontent', () => {
  for (const text of ['Config readiness', 'Login UI klaarzetten', 'Echte profielcontrole', 'Echte collectiecontrole', 'Kaarten preview']) {
    assert.doesNotMatch(dashboardSource, new RegExp(text));
    assert.doesNotMatch(appSource, new RegExp(text));
  }
});

test('alle hoofdtegels linken naar hun bestaande hashroute', () => {
  for (const href of ['#collection', '#wishlist', '#sets', '#search']) {
    assert.match(dashboardSource, new RegExp(`href: '${href}'`));
  }
});

test('bestaande hoofdnavigatie blijft compleet en dashboard komt uit de feature-index', () => {
  for (const label of ['Dashboard', 'Collection', 'Sets', 'Wishlist', 'Zoeken', 'Pokédex']) {
    assert.match(appSource, new RegExp(`label: '${label}'`));
  }
  assert.match(appSource, /import \{ DashboardPage \} from '\.\/features\/dashboard';/);
  assert.doesNotMatch(appSource, /function DashboardPage/);
});
