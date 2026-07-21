import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { type CardDetails } from '../../scripts/catalog/card-details.ts';
import { type CatalogCard, type DetailTarget, verifyTargetState } from '../../scripts/catalog/apply-catalog-details-complete-sets.ts';

const runner = readFileSync('scripts/catalog/apply-catalog-details-complete-sets.ts', 'utf8');
const migration = readFileSync('supabase/migrations/20260721210000_apply_catalog_details_complete_sets.sql', 'utf8');

test('complete-set details runner binds to the approved read-only quality audit', () => {
  assert.match(runner, /017a7cb5030cca30b9059b3e7e91171fc9c84cf2b24e7c55431706c25945d42f/);
  assert.match(runner, /EXPECTED_SET_COUNT = 35/);
  assert.match(runner, /EXPECTED_DETAIL_ROWS = 607/);
  assert.match(runner, /PRECHECK_BATCH_SIZE = 100/);
  assert.match(runner, /chunks\(targets, PRECHECK_BATCH_SIZE\)/);
  assert.match(runner, /Exacte detailkaart-precheck batch/);
  assert.match(runner, /canonieke catalogusidentiteit wijkt af/);
  assert.match(runner, /options\.mode === 'idempotency'/);
  assert.match(runner, /includeFilled \? entry\.expectedCards : auditSet\.missingCardDetails/);
  assert.match(runner, /Volledige detailscope kon niet worden opgebouwd/);
  assert.match(runner, /verifiedRows: targets\.length/);
  assert.match(runner, /issues\.length === 1 && result\.issues\[0] === 'missing_card_details'/);
  assert.match(runner, /validateLocalDatasetCheckout/);
});

test('dry-run and idempotency never invoke the database mutation RPC', () => {
  assert.match(runner, /options\.mode === 'write'/);
  assert.match(runner, /options\.mode === 'idempotency' \? 'filled' : 'empty'/);
  assert.match(runner, /plannedWrites: options\.mode === 'dry-run' \? EXPECTED_DETAIL_ROWS : 0/);
  assert.doesNotMatch(runner, /collection_cards.*\.(insert|update|upsert|delete)/);
  assert.doesNotMatch(runner, /card_external_references.*\.(insert|update|upsert|delete)/);
});

function createCompleteSetTargets(): DetailTarget[] {
  const targets: DetailTarget[] = [];
  for (let setIndex = 0; setIndex < 35; setIndex += 1) {
    const count = setIndex < 12 ? 18 : 17;
    for (let cardIndex = 0; cardIndex < count; cardIndex += 1) {
      const id = `card-${String(targets.length + 1).padStart(3, '0')}`;
      targets.push({
        id,
        externalId: `external-${id}`,
        setCode: `set-${String(setIndex + 1).padStart(2, '0')}`,
        details: { artist: `Artist ${id}` },
      });
    }
  }
  assert.equal(targets.length, 607);
  assert.equal(new Set(targets.map((target) => target.setCode)).size, 35);
  return targets;
}

function createReadOnlyClient(targets: DetailTarget[], divergentId?: string) {
  const cards = new Map<string, CatalogCard>(targets.map((target) => [target.id, {
    id: target.id,
    set_code: target.setCode,
    card_details: target.id === divergentId ? { artist: 'Wrong artist' } : target.details,
  }]));
  let rpcCalls = 0;
  const batchSizes: number[] = [];
  const client = {
    from(table: string) {
      if (table === 'cards_catalog') {
        return {
          select() {
            return {
              in(_column: string, ids: string[]) {
                batchSizes.push(ids.length);
                return Promise.resolve({ data: ids.map((id) => cards.get(id)).filter(Boolean), error: null });
              },
            };
          },
        };
      }
      if (table === 'card_external_references') {
        return {
          select() {
            return {
              eq() {
                return {
                  in(_column: string, ids: string[]) {
                    return Promise.resolve({ data: ids.map((id) => ({ card_catalog_id: id, external_id: `external-${id}` })), error: null });
                  },
                };
              },
            };
          },
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
    rpc() { rpcCalls += 1; throw new Error('RPC must not be called by idempotency verification.'); },
  };
  return { client, batchSizes, rpcCalls: () => rpcCalls };
}

test('idempotency function verifies all 607 cards across 35 sets read-only in batches', async () => {
  const targets = createCompleteSetTargets();
  const fake = createReadOnlyClient(targets);

  await verifyTargetState(fake.client as never, targets, 'filled');

  assert.deepEqual(fake.batchSizes, [100, 100, 100, 100, 100, 100, 7]);
  assert.equal(fake.rpcCalls(), 0);
});

test('idempotency function safely rejects one divergent detail without mutation', async () => {
  const targets = createCompleteSetTargets();
  const fake = createReadOnlyClient(targets, targets[306].id);

  await assert.rejects(
    verifyTargetState(fake.client as never, targets, 'filled'),
    /Database-precheck wijkt af; niets werd gewijzigd\./,
  );
  assert.equal(fake.rpcCalls(), 0);
});

test('transaction updates exactly the guarded card_details field with least privilege', () => {
  assert.match(migration, /jsonb_array_length\(p_rows\) <> 607/);
  assert.match(migration, /security invoker/);
  assert.match(migration, /revoke all.*from public/);
  assert.match(migration, /revoke all.*from anon/);
  assert.match(migration, /revoke all.*from authenticated/);
  assert.match(migration, /grant execute.*to service_role/);
  assert.match(migration, /set card_details = r\.target_card_details/);
  assert.match(migration, /from public\.card_external_references as cer/);
  assert.match(migration, /cer\.source = 'pokemon_tcg_api'/);
  assert.match(migration, /cer\.external_id = r\.expected_external_id/);
  assert.doesNotMatch(migration, /set\s+set_code\s*=/);
  assert.doesNotMatch(migration, /update public\.collection_cards|update public\.card_external_references/);
});
