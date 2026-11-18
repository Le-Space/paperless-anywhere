// Which builder versions keep their STOREs. Made-up hashes and dates.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { builderOf, listId, releasesInUse, retentionPlan, versionsFromHistory } from './image-retention.js';
import { RETIRED_STORE_MAX_BYTES, retiredStoreRefusal, retiredStoresToForget } from './forget-guard.js';

const h = (c) => c.repeat(64);
/** An own-image.js source with a builder whose hashes all start from `c`. */
const source = (c, { store = true } = {}) => `export const BUILDER = {
	program: {
		volumes: [
			{
				comment: '',
				hash_tree: '${h(c + '3').slice(0, 64)}',
				ref: '${h(c + '4').slice(0, 64)}',
				roothash: '${h(c + '5').slice(0, 64)}'
			}
		],
		workload: {
			hash_tree: '${h(c + '1').slice(0, 64)}',
			ref: '${h(c + '2').slice(0, 64)}',
			roothash: '${h(c).slice(0, 64)}'
		}
	},
	plain: {
		sha256: '${h(c + '6').slice(0, 64)}'${store ? `,\n\t\tstore: '${h(c + '7').slice(0, 64)}'` : ''},
		commit: 'abc'
	}
};`;
const v = (c) => h(c).slice(0, 64);
const s = (c, n) => h(c + n).slice(0, 64);
const DAY = 24 * 3600 * 1000;
const now = Date.parse('2026-12-20T00:00:00Z');
const history = ['a', 'b', 'c', 'd', 'e'].map((c, i) => ({ commit: `c${i}`, at: `2026-11-1${i}T10:00:00Z`, source: source(c) }));

describe('the builder versions', () => {
	it('reads the plain image and the four builder STOREs of a BUILDER', () => {
		expect(builderOf(source('a'))).toEqual({ roothash: v('a'), plainSha256: s('a', '6'), plainStore: s('a', '7'), stores: [s('a', '2'), s('a', '1'), s('a', '4'), s('a', '3'), s('a', '7')] });
		expect(builderOf('export const BUILDER = null;')).toBeNull();
	});

	it('reads the BUILDER of the own-image.js in this checkout', () => {
		const b = builderOf(readFileSync(new URL('./own-image.js', import.meta.url), 'utf8'));
		expect(b?.stores).toHaveLength(5);
		expect(b?.plainStore).toMatch(/^[0-9a-f]{64}$/);
	});

	it('takes one version per builder, oldest first', () => {
		const versions = versionsFromHistory([history[1], { ...history[1], commit: 'later', at: '2026-11-11T12:00:00Z' }, history[0]]);
		expect(versions.map((x) => x.roothash)).toEqual([v('a'), v('b')]);
		expect(versions[1].commit).toBe('c1');
	});
});

describe('the releases in use', () => {
	const releases = [
		{ tag: 'v1', publishedAt: '2026-12-01T00:00:00Z' },
		{ tag: 'v2', publishedAt: '2026-12-10T00:00:00Z' },
		{ tag: 'v3', publishedAt: '2026-12-15T00:00:00Z' }
	];
	it('are the newest, and each whose successor came out less than the grace ago', () => {
		expect(releasesInUse(releases, { now, graceDays: 7 }).map((r) => r.tag)).toEqual(['v2', 'v3']);
		expect(releasesInUse(releases, { now, graceDays: 7 })[0].until).toBe('2026-12-22T00:00:00.000Z');
		expect(releasesInUse(releases, { now, graceDays: 0 }).map((r) => r.tag)).toEqual(['v3']);
		expect(releasesInUse(releases, { now, graceDays: 30 }).map((r) => r.tag)).toEqual(['v1', 'v2', 'v3']);
	});
});

describe('the plan', () => {
	const versions = versionsFromHistory(history);
	const releases = [
		{ tag: 'v1', publishedAt: new Date(now - 40 * DAY).toISOString(), roothash: v('a') },
		{ tag: 'v2', publishedAt: new Date(now - 20 * DAY).toISOString(), roothash: v('b') },
		{ tag: 'v3', publishedAt: new Date(now - 10 * DAY).toISOString(), roothash: v('e') }
	];

	it('keeps the newest three, and retires the older ones', () => {
		const plan = retentionPlan({ versions, current: v('e'), releases, keep: 3, graceDays: 7, now });
		expect(plan.kept.map((k) => k.roothash)).toEqual([v('c'), v('d'), v('e')]);
		expect(plan.retired.map((r) => r.roothash)).toEqual([v('a'), v('b')]);
		expect(plan.retired[0].stores).toEqual(versions[0].stores);
		expect(plan.kept[2].why).toEqual(['the builder on main', 'one of the newest 3', 'release v3, the newest, in use']);
	});

	it('keeps an older version while a release in use names it', () => {
		const plan = retentionPlan({ versions, current: v('e'), releases, keep: 3, graceDays: 14, now });
		expect(plan.retired.map((r) => r.roothash)).toEqual([v('a')]);
		expect(plan.kept[0]).toEqual({ roothash: v('b'), why: [`release v2 in use until ${new Date(now + 4 * DAY).toISOString().slice(0, 10)}`] });
	});

	it('never retires a STORE a kept version names too', () => {
		const shared = versionsFromHistory([...history.slice(0, 4), { commit: 'x', at: '2026-11-15T10:00:00Z', source: source('e').replace(s('e', '4'), s('a', '4')) }]);
		const plan = retentionPlan({ versions: shared, current: v('e'), releases: [], keep: 3, graceDays: 0, now });
		expect(plan.retired[0].stores).not.toContain(s('a', '4'));
		expect(plan.keptStores.has(s('a', '4'))).toBe(true);
	});

	it('refuses a plan whose builder on main is not in the history, and odd numbers', () => {
		expect(() => retentionPlan({ versions, current: v('f'), releases, keep: 3, graceDays: 7, now })).toThrow(/not in the history/);
		expect(() => retentionPlan({ versions, current: v('e'), releases, keep: 0, graceDays: 7, now })).toThrow(/keep/);
	});

	it('names a list by its content, in any order', async () => {
		expect(await listId([s('a', '1'), s('a', '2')])).toBe(await listId([s('a', '2'), s('a', '1')]));
		expect(await listId([s('a', '1')])).not.toBe(await listId([s('a', '2')]));
		expect(await listId([s('a', '1')])).toMatch(/^[0-9a-f]{16}$/);
	});
});

describe('the guard for a retired version', () => {
	const account = '0x' + 'a'.repeat(40);
	const file = (n) => 'f'.repeat(63) + n;
	const store = (n, over = {}) => ({ hash: s('a', n), file: file(n), status: 'processed', type: 'STORE', sender: account, size: 300e6, ...over });
	const o = (over = {}) => ({ account, retiredFiles: new Set(['1', '2'].map(file)), keptFiles: new Set([file('9')]), kept: new Set(), ...over });

	it('lets a STORE of a retired version go', () => {
		expect(retiredStoreRefusal(store('1'), o())).toBeNull();
		expect(retiredStoreRefusal(store('1', { size: 880e6 }), o())).toBeNull();
	});
	it('refuses what main or a release in use names, and a file a kept version holds', () => {
		expect(retiredStoreRefusal(store('1'), o({ kept: new Set([s('a', '1')]) }))).toMatch(/release in use/);
		expect(retiredStoreRefusal(store('1', { file: file('9') }), o())).toMatch(/kept version/);
		expect(retiredStoreRefusal(store('1', { file: file('3') }), o())).toMatch(/not one of a retired version/);
	});
	it('refuses another sender, a STORE not processed, an unknown file or size, and anything larger than a plain image', () => {
		expect(retiredStoreRefusal(store('1', { sender: '0x' + 'b'.repeat(40) }), o())).toMatch(/sent by/);
		expect(retiredStoreRefusal(store('1', { status: 'forgotten' }), o())).toMatch(/not a processed STORE/);
		expect(retiredStoreRefusal(store('1', { file: null }), o())).toMatch(/file is unknown/);
		expect(retiredStoreRefusal(store('1', { size: null }), o())).toMatch(/size unknown/);
		expect(retiredStoreRefusal(store('1', { size: RETIRED_STORE_MAX_BYTES + 1 }), o())).toMatch(/larger than/);
	});
	it('forgets nothing when one is refused', () => {
		expect(retiredStoresToForget([store('1'), store('2')], o())).toEqual({ forget: [s('a', '1'), s('a', '2')], refused: [] });
		const r = retiredStoresToForget([store('1'), store('2', { sender: 'x' })], o());
		expect(r.forget).toEqual([]);
		expect(r.refused).toHaveLength(1);
	});
});
