// The daily watch over the storage providers (scripts/provider-watch.mjs,
// .github/workflows/provider-watch.yml). It reads only public facts (the
// registry, Warm Storage's approved list, each provider's PDP ping, and the
// proofs of the newest data sets on the chain) and reports five things as
// GitHub issues, one open issue per event:
//
//   down:<id>    a provider Le Space uses (approved, active, not blocked, in
//                Europe) does not answer its ping; closed when it answers
//   proofs:<id>  such a provider's newest data sets miss their proofs;
//                closed when they are proven again
//   back:<id>    a blocked provider (blocked-providers.js) answered and was
//                active in the registry on BACK_DAYS days in a row (once per
//                stretch); the block stays until Nico lifts it
//   new:<id>     a provider was approved (check the landing page's picks)
//   lost:<id>    a provider lost its approval or is no longer active
//
// Only public provider data goes into an issue: id, name, country, the
// registered domain of its service URL. No customer, payer or piece.
//
// Between runs the watch keeps a small state (which ids were approved and
// active, how many days in a row each blocked provider answered); the
// workflow carries it from run to run as an artifact. Without one (the first
// run, or an artifact that expired) the run only takes stock: no new or lost
// provider is reported then.

import { REGION_PRESETS } from './providers.js';

/** Days in a row a blocked provider must answer before it is reported. */
export const BACK_DAYS = 3;

/** The label every issue of the watch carries. */
export const LABEL = 'provider-watch';

/** Kinds that close by themselves once the condition is gone. */
const CLOSES = new Set(['down', 'proofs']);

/**
 * @typedef {{ id: number, name: string, country: string | null, operator: string | null, endorsed: boolean, active: boolean, blocked?: string | null }} Listed
 * @typedef {{ approved: number[], active: number[], backDays: Record<string, number>, day: string | null }} WatchState
 * @typedef {{ key: string, kind: 'down' | 'proofs' | 'back' | 'new' | 'lost', id: number, open: boolean, title: string, body: string }} WatchEvent
 *   open: the condition holds (open the issue, or keep it open); false: it is gone (close an open one)
 * @typedef {{
 *   providers: Listed[],
 *   answers: Record<string, boolean>,
 *   proofs: Record<string, { checked: number, late: number }>,
 *   blocked: Array<{ id: number, name: string, country: string | null, operator: string | null, active: boolean, answers: boolean }>
 * }} Snapshot providers: the approved ones (listProviders); answers: ping per id; proofs: per watched id, of its newest data sets; blocked: the blocked ones, from the registry
 */

const EUROPE = new Set(REGION_PRESETS.EUROPE);

/** The providers the watch looks after: approved, active, not blocked, in Europe. @param {Listed[]} providers */
export const watched = (providers) => providers.filter((p) => p.active && !p.blocked && EUROPE.has(p.country ?? ''));

/** "36 Cello (FR, fidl.tech)" @param {{ id: number, name: string, country: string | null, operator: string | null }} p */
const who = (p) => `${p.id} ${p.name} (${[p.country ?? '??', p.operator ?? 'no domain'].join(', ')})`;

/** One line per public fact of a provider, for an issue body. */
const facts = (/** @type {Listed | Snapshot['blocked'][number]} */ p) =>
	[`- id: ${p.id}`, `- name: ${p.name}`, `- country: ${p.country ?? 'unknown'}`, `- operator (registered domain): ${p.operator ?? 'unknown'}`, ...('endorsed' in p ? [`- endorsed: ${p.endorsed ? 'yes' : 'no'}`] : [])].join('\n');

/**
 * What today's snapshot says against the last state.
 * @param {Snapshot} snap
 * @param {WatchState | null} last
 * @param {string} day today, YYYY-MM-DD (UTC)
 * @returns {{ events: WatchEvent[], state: WatchState }}
 */
export function assess(snap, last, day) {
	/** @type {WatchEvent[]} */
	const events = [];
	const ids = (/** @type {Listed[]} */ l) => l.map((p) => p.id);
	const approved = ids(snap.providers);
	const active = ids(snap.providers.filter((p) => p.active));

	for (const p of watched(snap.providers)) {
		const answers = snap.answers[p.id] === true;
		events.push({
			key: `down:${p.id}`,
			kind: 'down',
			id: p.id,
			open: !answers,
			title: `Provider ${who(p)} does not answer`,
			body: `The provider's PDP ping (\`/pdp/ping\` on its service URL) did not answer in three tries during today's run. It is one Le Space uses or recommends (approved, active, not blocked, in Europe).\n\n${facts(p)}\n\nThis issue closes by itself once the provider answers again.`
		});
		const proof = snap.proofs[p.id];
		if (proof && proof.checked > 0) {
			events.push({
				key: `proofs:${p.id}`,
				kind: 'proofs',
				id: p.id,
				open: proof.late * 2 > proof.checked,
				title: `Provider ${who(p)} misses its proofs`,
				body: `Of its ${proof.checked} newest live data sets on the chain, ${proof.late} have no proof for more than two proving periods or passed their deadline unproven.\n\n${facts(p)}\n\nThis issue closes by itself once most of them are proven on time again.`
			});
		}
	}

	/** @type {Record<string, number>} */
	const backDays = {};
	for (const b of snap.blocked) {
		const up = b.active && b.answers;
		const before = last?.backDays?.[b.id] ?? 0;
		// One day counts once, however often the watch runs that day.
		backDays[b.id] = !up ? 0 : last?.day === day ? Math.max(before, 1) : before + 1;
		// Reported once per stretch: on the day it reaches BACK_DAYS.
		if (backDays[b.id] === BACK_DAYS) {
			events.push({
				key: `back:${b.id}`,
				kind: 'back',
				id: b.id,
				open: true,
				title: `Blocked provider ${who(b)} is reachable again`,
				body: `The provider is in \`pwa/src/lib/blocked-providers.js\` and has answered its PDP ping, active in the registry, on ${backDays[b.id]} days in a row.\n\n${facts(b)}\n\nThe block stays: whether it is lifted is Nico's decision.`
			});
		}
	}

	if (last) {
		const was = new Set(last.approved);
		const wasActive = new Set(last.active);
		for (const p of snap.providers) {
			if (was.has(p.id)) continue;
			events.push({
				key: `new:${p.id}`,
				kind: 'new',
				id: p.id,
				open: true,
				title: `Provider ${who(p)} was approved`,
				body: `Warm Storage approved a new provider.\n\n${facts(p)}\n\nThe landing page names its recommended providers by hand: please check whether it should change.`
			});
		}
		for (const id of last.approved) {
			const now = snap.providers.find((p) => p.id === id);
			if (now && (now.active || !wasActive.has(id))) continue;
			const p = now ?? snap.blocked.find((b) => b.id === id) ?? { id, name: `provider ${id}`, country: null, operator: null };
			events.push({
				key: `lost:${id}`,
				kind: 'lost',
				id,
				open: true,
				title: now ? `Provider ${who(p)} is no longer active` : `Provider ${id} lost its approval`,
				body: `${now ? 'The registry no longer lists the provider as active.' : 'Warm Storage no longer lists the provider as approved.'}\n\n${facts(p)}\n\nBackups placed there keep their data sets until those end; new backups do not go there.`
			});
		}
	}
	return { events, state: { approved, active, backDays, day } };
}

/** The hidden marker that ties an issue to its event. @param {string} key */
export const marker = (key) => `<!-- ${LABEL}:${key} -->`;

/**
 * Bring the issues in line with the events: open an issue for an event that
 * holds and has none open, close one whose event is gone (down, proofs).
 * @param {WatchEvent[]} events
 * @param {{ openIssues: () => Promise<Array<{ number: number, body: string | null }>>, create: (title: string, body: string) => Promise<number>, close: (number: number, comment: string) => Promise<void> }} github
 * @returns {Promise<Array<{ key: string, action: 'opened' | 'closed', number: number }>>}
 */
export async function syncIssues(events, github) {
	const open = await github.openIssues();
	const issueFor = (/** @type {string} */ key) => open.find((i) => String(i.body ?? '').includes(marker(key)));
	/** @type {Array<{ key: string, action: 'opened' | 'closed', number: number }>} */
	const done = [];
	for (const e of events) {
		const issue = issueFor(e.key);
		if (e.open && !issue) done.push({ key: e.key, action: 'opened', number: await github.create(e.title, `${e.body}\n\n${marker(e.key)}`) });
		else if (!e.open && issue && CLOSES.has(e.kind)) {
			await github.close(issue.number, 'Cleared in today\'s run of the provider watch.');
			done.push({ key: e.key, action: 'closed', number: issue.number });
		}
	}
	return done;
}
