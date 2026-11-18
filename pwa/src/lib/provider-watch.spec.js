// The daily provider watch: what it reports from a snapshot and the last
// state, and how it keeps one open issue per event. Made-up providers.
import { describe, expect, it } from 'vitest';
import { assess, BACK_DAYS, marker, syncIssues, watched } from './provider-watch.js';

const P = (id, extra = {}) => ({ id, name: `Made-up ${id}`, country: 'DE', operator: `sp${id}.example`, endorsed: false, active: true, blocked: null, ...extra });
const providers = [P(1, { endorsed: true }), P(2, { country: 'US' }), P(3, { country: 'FI' })];
const snap = (extra = {}) => ({ providers, answers: { 1: true, 3: true }, proofs: { 1: { checked: 3, late: 0 }, 3: { checked: 3, late: 0 } }, blocked: [], ...extra });
const last = { approved: [1, 2, 3], active: [1, 2, 3], backDays: {}, day: '2026-11-17' };
const opened = (r) => r.events.filter((e) => e.open).map((e) => e.key);

describe('what the watch reports', () => {
	it('looks after the active, unblocked providers in Europe only', () => {
		expect(watched([...providers, P(4, { blocked: 'fidl' }), P(5, { active: false }), P(6, { country: 'CH' })]).map((p) => p.id)).toEqual([1, 3, 6]);
	});

	it('a quiet day reports nothing', () => {
		expect(opened(assess(snap(), last, '2026-11-18'))).toEqual([]);
	});

	it('a watched provider that does not answer, or misses most proofs, is reported at once; one outside Europe is not', () => {
		const r = assess(snap({ answers: { 1: false, 2: false, 3: true }, proofs: { 1: { checked: 3, late: 0 }, 3: { checked: 3, late: 2 } } }), last, '2026-11-18');
		expect(opened(r)).toEqual(['down:1', 'proofs:3']);
		expect(r.events.find((e) => e.key === 'down:1').title).toBe('Provider 1 Made-up 1 (DE, sp1.example) does not answer');
		// One late of three is no majority; no data set to check says nothing.
		expect(opened(assess(snap({ proofs: { 1: { checked: 3, late: 1 }, 3: { checked: 0, late: 0 } } }), last, '2026-11-18'))).toEqual([]);
	});

	it(`a blocked provider is reported only after ${BACK_DAYS} days in a row up and active, once per stretch`, () => {
		const b = (answers, active = true) => [{ id: 36, name: 'Made-up blocked', country: 'FR', operator: 'blocked.example', active, answers }];
		let state = last;
		const days = ['2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21'];
		const seen = days.map((d) => {
			const r = assess(snap({ blocked: b(true) }), state, d);
			state = r.state;
			return opened(r);
		});
		expect(seen).toEqual([[], [], ['back:36'], []]);
		expect(state.backDays[36]).toBe(4);
		// Two runs on one day count once; a day without answer, or inactive in the registry, starts again.
		expect(assess(snap({ blocked: b(true) }), { ...last, backDays: { 36: 2 }, day: '2026-11-18' }, '2026-11-18').state.backDays[36]).toBe(2);
		expect(assess(snap({ blocked: b(false) }), { ...last, backDays: { 36: 2 } }, '2026-11-18').state.backDays[36]).toBe(0);
		expect(assess(snap({ blocked: b(true, false) }), { ...last, backDays: { 36: 2 } }, '2026-11-18').state.backDays[36]).toBe(0);
	});

	it('a newly approved provider is reported with its public facts and the hint at the landing page', () => {
		const r = assess(snap({ providers: [...providers, P(9, { country: 'NL', endorsed: true })], answers: { 1: true, 3: true, 9: true } }), last, '2026-11-18');
		expect(opened(r)).toEqual(['new:9']);
		const body = r.events.find((e) => e.key === 'new:9').body;
		for (const s of ['- id: 9', '- name: Made-up 9', '- country: NL', '- operator (registered domain): sp9.example', '- endorsed: yes', 'landing page']) expect(body).toContain(s);
	});

	it('a provider that lost its approval or is no longer active is reported', () => {
		const r = assess(snap({ providers: [providers[0], P(3, { country: 'FI', active: false })] }), last, '2026-11-18');
		expect(opened(r)).toEqual(['lost:2', 'lost:3']);
		expect(r.events.find((e) => e.key === 'lost:2').title).toBe('Provider 2 lost its approval');
		expect(r.events.find((e) => e.key === 'lost:3').title).toContain('no longer active');
	});

	it('without a state the first run only takes stock', () => {
		const r = assess(snap({ providers: [...providers, P(9)], answers: { 1: true, 3: true, 9: true } }), null, '2026-11-18');
		expect(opened(r)).toEqual([]);
		expect(r.state).toEqual({ approved: [1, 2, 3, 9], active: [1, 2, 3, 9], backDays: {}, day: '2026-11-18' });
	});
});

describe('the issues', () => {
	const hub = (open = []) => {
		const log = [];
		let n = 100;
		return {
			log,
			openIssues: async () => open,
			create: async (title, body) => (log.push(['create', title, body]), ++n),
			close: async (number) => void log.push(['close', number])
		};
	};

	it('opens one issue per event, not a second while one is open, and closes a cleared one', async () => {
		const events = [
			{ key: 'down:1', kind: 'down', id: 1, open: true, title: 'down 1', body: 'b' },
			{ key: 'down:3', kind: 'down', id: 3, open: false, title: 'down 3', body: 'b' },
			{ key: 'proofs:1', kind: 'proofs', id: 1, open: true, title: 'proofs 1', body: 'b' }
		];
		const gh = hub([{ number: 7, body: `x ${marker('proofs:1')}` }, { number: 8, body: marker('down:3') }]);
		const done = await syncIssues(events, gh);
		expect(done).toEqual([{ key: 'down:1', action: 'opened', number: 101 }, { key: 'down:3', action: 'closed', number: 8 }]);
		expect(gh.log[0][2]).toContain(marker('down:1'));
	});

	it('never closes a report someone has to read: new, lost, back', async () => {
		const gh = hub([{ number: 9, body: marker('new:9') }]);
		expect(await syncIssues([{ key: 'new:9', kind: 'new', id: 9, open: false, title: 't', body: 'b' }], gh)).toEqual([]);
	});
});
