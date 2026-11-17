// When a backup's provider does not answer: a replacement at an operator
// that holds none of the other copies, in the backup's region, that answers
// now. The person confirms; then the new places go to the running VM
// (pushBackupPlaces in lifecycle.js) and the backup goes on.
import { copyAnswers } from './restore-reach.js';
import { oneOperator, regionCodes, REGION_PRESETS } from './providers.js';

const EU_CODES = REGION_PRESETS.EU;

/**
 * @param {{
 *   providers: import('./providers.js').Provider[],
 *   ids: number[],
 *   down: number[],
 *   regions?: string[],
 *   answers?: (url: string) => Promise<boolean>
 * }} a `ids` the providers the backup goes to now, `down` those of them that do not answer
 * @returns {Promise<{ ids: number[], replaced: { from: import('./providers.js').Provider | { id: number }, to: import('./providers.js').Provider | null }[] }>}
 */
export async function replacementPlan({ providers, ids, down, regions = [], answers = (url) => copyAnswers(url, { timeoutMs: 8000 }) }) {
	const codes = regionCodes(regions);
	// EU first within a wider region (as pickProviders), else the list's order.
	const eu = (/** @type {import('./providers.js').Provider} */ p) => EU_CODES.includes(p.country ?? '');
	const candidates = codes.length ? [...providers].sort((a, b) => Number(eu(b)) - Number(eu(a))) : providers;
	const byId = new Map(providers.map((p) => [p.id, p]));
	const kept = ids.filter((id) => !down.includes(id)).map((id) => byId.get(id)).filter(Boolean);
	/** @type {{ from: any, to: any }[]} */
	const replaced = [];
	const chosen = [...kept];
	for (const id of down) {
		const from = byId.get(id) ?? { id };
		let to = null;
		for (const p of candidates) {
			if (!p.active || p.blocked || !p.url || ids.includes(p.id) || chosen.some((q) => q.id === p.id)) continue;
			if (codes.length && !codes.includes(p.country ?? '')) continue;
			// Not at the operator of a copy that stays, nor of the one that failed.
			if (chosen.some((q) => oneOperator(q, p)) || (byId.get(id) && oneOperator(/** @type {any} */ (byId.get(id)), p))) continue;
			if (await answers(`${String(p.url).replace(/\/+$/, '')}/pdp/ping`)) {
				to = p;
				break;
			}
		}
		if (to) chosen.push(to);
		replaced.push({ from, to });
	}
	const next = ids.map((id) => replaced.find((r) => r.from.id === id)?.to?.id ?? id).filter((id) => !replaced.some((r) => r.from.id === id && !r.to));
	return { ids: next, replaced };
}
