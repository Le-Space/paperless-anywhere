// What the Filecoin chain says about each copy of a backup, read by the app
// itself from the contracts: the PDPVerifier (is the data set live, are the
// backup's pieces in it, when was it last proven, when is the next
// challenge), Filecoin Warm Storage (proving deadline, which proving periods
// were proven, whether the service was ended) and Filecoin Pay (the rail that
// pays the provider, and until when the paying account covers it).
//
// Only read calls (eth_call), no key and no funds. The provider is not
// asked for any of this; what it says is shown apart, as "reported".
// readCopy() reads, copyState() turns the answers into lights (pure).

import { createPublicClient, http, maxUint256 } from 'viem';
import { multicall, getBlockNumber } from 'viem/actions';
import { resolveAccountState } from '@filoz/synapse-core/pay';
import { filecoinChain } from './permissions.js';

/** Proving periods looked back on for missed proofs (on mainnet a period is a day). */
export const PERIODS_CHECKED = 30;

/** Seconds per Filecoin epoch. */
export const EPOCH_SECONDS = 30;

/** A Filecoin epoch as a time (ms since 1970), from the chain's genesis. @param {bigint | number} epoch @param {number} genesis seconds */
export const epochTime = (epoch, genesis) => (genesis + Number(epoch) * EPOCH_SECONDS) * 1000;

/**
 * FilOzone's PDP Explorer: a data set by its number, a piece by its CID
 * (the routes /:network/dataset/:dataSetId and /:network/piece/:cid).
 * For a person to look for themselves; the app reads nothing from it.
 */
export const pdpExplorer = {
	dataSet: (/** @type {string} */ network, /** @type {string | bigint} */ id) => `https://pdp.filecoin.cloud/${network === 'mainnet' ? 'mainnet' : 'calibration'}/dataset/${encodeURIComponent(String(id))}`,
	piece: (/** @type {string} */ network, /** @type {string} */ cid) => `https://pdp.filecoin.cloud/${network === 'mainnet' ? 'mainnet' : 'calibration'}/piece/${encodeURIComponent(cid)}`
};

/** @typedef {'off' | 'run' | 'app' | 'reported' | 'failed'} ChainLight */

/**
 * The answers of the contracts for one copy, as they came (bigints).
 * @typedef {{
 *   epoch: bigint,
 *   live: boolean | null,
 *   piecesLive: Array<boolean | null>,
 *   lastProven: bigint | null,
 *   nextChallenge: bigint | null, 0n: none scheduled
 *   deadline: bigint | null,
 *   provenThisPeriod: boolean | null,
 *   activation: bigint | null,
 *   maxProvingPeriod: bigint | null,
 *   periods: Array<{ id: bigint, proven: boolean | null }>,
 *   info: { pdpRailId: bigint, payer: string, pdpEndEpoch: bigint } | null,
 *   rail: { token: string, from: string, paymentRate: bigint, lockupPeriod: bigint, endEpoch: bigint } | null,
 *   account: { funds: bigint, lockupCurrent: bigint, lockupRate: bigint, lockupLastSettledAt: bigint } | null
 * }} CopyAnswers
 */

/** A multicall answer, or null where that call failed. */
const ok = (/** @type {{ status: string, result?: any }} */ r) => (r?.status === 'success' ? r.result : null);

/**
 * The proving periods that ended before `epoch`, newest last, at most `n`:
 * the ids Filecoin Warm Storage keeps `provenPeriods` under. A period N of a
 * data set activated at A with length M is the epochs (A+N·M, A+(N+1)·M];
 * its deadline, the last epoch a proof counts, is A+(N+1)·M.
 * @param {bigint} activation @param {bigint} length @param {bigint} epoch @param {number} [n]
 * @returns {bigint[]}
 */
export function endedPeriods(activation, length, epoch, n = PERIODS_CHECKED) {
	if (!activation || !length || epoch <= activation) return [];
	const current = (epoch - activation - 1n) / length; // the period `epoch` is in, still open
	const from = current > BigInt(n) ? current - BigInt(n) : 0n;
	const ids = [];
	for (let id = from; id < current; id++) ids.push(id);
	return ids;
}

/**
 * Read one copy's state from the chain: three rounds of read calls.
 * @param {any} client a viem public client on the copy's network (synapse-core's chain)
 * @param {{ dataSetId: string | bigint, pieceIds?: Array<string | bigint> }} copy
 * @returns {Promise<CopyAnswers>}
 */
export async function readCopy(client, { dataSetId, pieceIds = [] }) {
	const { pdp, fwssView, filecoinPay } = client.chain.contracts;
	const id = BigInt(dataSetId);
	const at = (/** @type {any} */ c, /** @type {string} */ functionName, /** @type {any[]} */ args = []) => ({ address: c.address, abi: c.abi, functionName, args });
	const [epoch, first] = await Promise.all([
		getBlockNumber(client, { cacheTime: 0 }),
		multicall(client, {
			allowFailure: true,
			contracts: [
				at(pdp, 'dataSetLive', [id]),
				at(pdp, 'getDataSetLastProvenEpoch', [id]),
				at(pdp, 'getNextChallengeEpoch', [id]),
				at(fwssView, 'provingDeadline', [id]),
				at(fwssView, 'provenThisPeriod', [id]),
				at(fwssView, 'provingActivationEpoch', [id]),
				at(fwssView, 'getPDPConfig'),
				at(fwssView, 'getDataSet', [id]),
				...pieceIds.map((p) => at(pdp, 'pieceLive', [id, BigInt(p)]))
			]
		})
	]);
	const [live, lastProven, nextChallenge, deadline, provenThisPeriod, activation, config, info] = first.map(ok);
	const piecesLive = first.slice(8).map((r) => (r.status === 'success' ? Boolean(r.result) : null));
	const maxProvingPeriod = config ? BigInt(config[0]) : null;
	const ids = activation != null && maxProvingPeriod ? endedPeriods(BigInt(activation), maxProvingPeriod, epoch) : [];
	const railId = info?.pdpRailId ? BigInt(info.pdpRailId) : 0n;

	const second = await multicall(client, {
		allowFailure: true,
		contracts: [...(railId ? [at(filecoinPay, 'getRail', [railId])] : []), ...ids.map((p) => at(fwssView, 'provenPeriods', [id, p]))]
	});
	const rail = railId ? ok(second[0]) : null;
	const periods = ids.map((p, i) => ({ id: p, proven: ((r) => (r.status === 'success' ? Boolean(r.result) : null))(second[i + (railId ? 1 : 0)]) }));

	let account = null;
	if (rail) {
		const [answer] = await multicall(client, { allowFailure: true, contracts: [at(filecoinPay, 'accounts', [rail.token, rail.from])] });
		const a = ok(answer);
		if (a) account = { funds: a[0], lockupCurrent: a[1], lockupRate: a[2], lockupLastSettledAt: a[3] };
	}
	return {
		epoch,
		live: live == null ? null : Boolean(live),
		piecesLive,
		lastProven: lastProven == null ? null : BigInt(lastProven),
		// 0 and the largest number both mean: no challenge scheduled.
		nextChallenge: nextChallenge == null ? null : BigInt(nextChallenge) > 0n && BigInt(nextChallenge) < maxUint256 ? BigInt(nextChallenge) : 0n,
		deadline: deadline == null ? null : BigInt(deadline),
		provenThisPeriod: provenThisPeriod == null ? null : Boolean(provenThisPeriod),
		activation: activation == null ? null : BigInt(activation),
		maxProvingPeriod,
		periods,
		info: info ? { pdpRailId: BigInt(info.pdpRailId), payer: info.payer, pdpEndEpoch: BigInt(info.pdpEndEpoch) } : null,
		rail: rail ? { token: rail.token, from: rail.from, paymentRate: BigInt(rail.paymentRate), lockupPeriod: BigInt(rail.lockupPeriod), endEpoch: BigInt(rail.endEpoch) } : null,
		account
	};
}

/**
 * One copy's lights, from the contracts' answers. Every light here is the
 * app's own reading of the chain: green ("app") where it is fine, red
 * ("failed") where the chain says something is wrong, dark ("off") where
 * the chain did not answer or there is nothing to say yet.
 * @param {CopyAnswers} a
 * @param {{ genesis: number }} chain genesis in seconds
 * @returns {{
 *   lights: Array<{ id: 'dataSet' | 'lastProof' | 'nextChallenge' | 'faults' | 'paid', state: ChainLight, note: string, at?: number, epoch?: string, count?: number, of?: number }>,
 *   state: 'app' | 'failed' | 'off'
 * }}
 */
export function copyState(a, { genesis }) {
	const time = (/** @type {bigint} */ e) => epochTime(e, genesis);
	const period = a.maxProvingPeriod ?? 0n;
	/** @type {ReturnType<typeof copyState>['lights']} */
	const lights = [];

	// The data set: live at the PDPVerifier, the service not ended, and every
	// piece of this backup still in it.
	const ended = Boolean(a.info && a.info.pdpEndEpoch > 0n);
	const piecesGone = a.piecesLive.filter((p) => p === false).length;
	if (a.live == null) lights.push({ id: 'dataSet', state: 'off', note: 'unread' });
	else if (!a.live) lights.push({ id: 'dataSet', state: 'failed', note: 'notLive' });
	else if (piecesGone) lights.push({ id: 'dataSet', state: 'failed', note: 'piecesGone', count: piecesGone, of: a.piecesLive.length });
	else if (ended) lights.push({ id: 'dataSet', state: 'failed', note: 'ending', epoch: String(a.info?.pdpEndEpoch), at: time(/** @type {bigint} */ (a.info?.pdpEndEpoch)) });
	else lights.push({ id: 'dataSet', state: 'app', note: a.piecesLive.length ? 'live' : 'liveSet', count: a.piecesLive.length });

	// The last proof the PDPVerifier accepted. Older than two proving periods
	// means at least one period went by without one.
	if (a.lastProven == null) lights.push({ id: 'lastProof', state: 'off', note: 'unread' });
	else if (a.lastProven === 0n) lights.push({ id: 'lastProof', state: a.live === false ? 'failed' : 'off', note: 'none' });
	else {
		const late = period > 0n && a.epoch - a.lastProven > 2n * period;
		lights.push({ id: 'lastProof', state: late ? 'failed' : 'app', note: late ? 'old' : 'recent', epoch: String(a.lastProven), at: time(a.lastProven) });
	}

	// The next challenge, and whether the current period's deadline passed
	// without a proof.
	const overdue = a.deadline != null && a.deadline > 0n && a.epoch > a.deadline && a.provenThisPeriod === false;
	if (a.nextChallenge == null || a.nextChallenge === 0n) lights.push({ id: 'nextChallenge', state: a.live === true && a.nextChallenge === 0n && a.piecesLive.length ? 'failed' : 'off', note: a.nextChallenge === 0n || a.live === false ? 'none' : 'unread' });
	else if (overdue) lights.push({ id: 'nextChallenge', state: 'failed', note: 'overdue', epoch: String(a.deadline), at: time(/** @type {bigint} */ (a.deadline)) });
	else lights.push({ id: 'nextChallenge', state: 'app', note: a.nextChallenge < a.epoch ? 'due' : 'scheduled', epoch: String(a.nextChallenge), at: time(a.nextChallenge) });

	// Missed proofs: ended proving periods with no proof recorded. Filecoin
	// Warm Storage counts each one as a fault and pays nothing for it.
	const known = a.periods.filter((p) => p.proven != null);
	const missed = known.filter((p) => p.proven === false).length;
	if (!a.periods.length) lights.push(a.activation ? { id: 'faults', state: 'app', note: 'noneEnded', count: 0, of: 0 } : { id: 'faults', state: 'off', note: a.activation == null ? 'unread' : 'notStarted', count: 0, of: 0 });
	else if (!known.length) lights.push({ id: 'faults', state: 'off', note: 'unread', count: 0, of: a.periods.length });
	else lights.push({ id: 'faults', state: missed ? 'failed' : 'app', note: missed ? 'missed' : 'none', count: missed, of: known.length });

	// Paid until: a rail that ended pays to its end; a running one as long as
	// the paying account covers its lockups (Filecoin Pay's own sum).
	if (!a.rail || !a.account) lights.push({ id: 'paid', state: 'off', note: a.info && !a.info.pdpRailId ? 'noRail' : 'unread' });
	else if (a.rail.endEpoch > 0n) lights.push({ id: 'paid', state: 'failed', note: 'railEnded', epoch: String(a.rail.endEpoch), at: time(a.rail.endEpoch) });
	else if (a.account.lockupRate === 0n) lights.push({ id: 'paid', state: 'app', note: 'noRate' });
	else {
		const { runwayInEpochs } = resolveAccountState({ ...a.account, currentEpoch: a.epoch });
		const until = a.epoch + runwayInEpochs;
		// More than a century ahead: no date worth showing.
		if (runwayInEpochs > 100n * 365n * 2880n) lights.push({ id: 'paid', state: 'app', note: 'noRate' });
		else lights.push({ id: 'paid', state: runwayInEpochs > 0n ? 'app' : 'failed', note: runwayInEpochs > 0n ? 'until' : 'runOut', epoch: String(until), at: time(until), count: Number(a.rail.lockupPeriod / 2880n) });
	}

	const states = lights.map((l) => l.state);
	return { lights, state: states.includes('failed') ? 'failed' : states.every((s) => s === 'app') ? 'app' : 'off' };
}

/**
 * Ask the provider for the first bytes of the backup's first piece. Only
 * what the provider says: a range cannot be checked against the piece CID
 * (that needs the whole piece), so the answer is "reported", never green.
 * @param {string} url the copy's retrieval URL (…/piece/<piece CID>)
 * @param {{ fetch?: typeof fetch, timeoutMs?: number }} [o]
 * @returns {Promise<{ state: 'reported' | 'failed' | 'off', note: 'answers' | 'status' | 'silent', status?: number, bytes?: number }>}
 */
export async function sampleFetch(url, { fetch: fetchImpl = fetch, timeoutMs = 10_000 } = {}) {
	if (!/^https:\/\/[^/]+\/piece\/[a-z0-9]+$/i.test(String(url ?? ''))) return { state: 'off', note: 'silent' };
	try {
		const res = await fetchImpl(url, { headers: { Range: 'bytes=0-1023' }, cache: 'no-store', signal: AbortSignal.timeout(timeoutMs) });
		if (!res.ok) return { state: 'failed', note: 'status', status: res.status };
		const bytes = (await res.arrayBuffer()).byteLength;
		return bytes > 0 ? { state: 'reported', note: 'answers', status: res.status, bytes } : { state: 'failed', note: 'status', status: res.status };
	} catch {
		// Unreachable, or the browser was not allowed to read the answer (CORS): no verdict.
		return { state: 'off', note: 'silent' };
	}
}

/**
 * Every copy of a backup, read from the chain. A copy whose data set the
 * list does not name is left out.
 * @param {{ network: string, copies: Array<{ providerId: string, dataSetId?: string, pieceIds?: string[], place?: string }>, transport?: any }} o
 */
export async function checkBackupOnChain({ network, copies, transport }) {
	const chain = filecoinChain(network);
	const client = createPublicClient({ chain, transport: transport ?? http(undefined, { retryCount: 1, timeout: 20_000 }) });
	const genesis = /** @type {any} */ (chain).genesisTimestamp;
	return Promise.all(
		copies
			.filter((c) => c.dataSetId != null)
			.map(async (c) => {
				try {
					const answers = await readCopy(client, { dataSetId: /** @type {string} */ (c.dataSetId), pieceIds: c.pieceIds ?? [] });
					return { providerId: c.providerId, dataSetId: String(c.dataSetId), place: c.place ?? '', ...copyState(answers, { genesis }), epoch: String(answers.epoch), error: null };
				} catch (e) {
					return { providerId: c.providerId, dataSetId: String(c.dataSetId), place: c.place ?? '', lights: [], state: /** @type {const} */ ('off'), epoch: null, error: e instanceof Error ? e.message : String(e) };
				}
			})
	);
}
