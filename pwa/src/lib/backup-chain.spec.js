import { describe, expect, it } from 'vitest';
import { custom, decodeFunctionData, encodeFunctionResult, isAddressEqual, multicall3Abi, numberToHex } from 'viem';
import { calibration, mainnet } from '@filoz/synapse-core/chains';
import { checkBackupOnChain, copyState, endedPeriods, epochTime, pdpExplorer, sampleFetch } from './backup-chain.js';

// A made-up chain: the contracts answer from a table, through viem's own
// multicall, as an RPC node would. No real data set, address or hash.
const PAYER = '0x00000000000000000000000000000000000000aa';
const TOKEN = '0x00000000000000000000000000000000000000bb';
const DAY = 2880n;

/** A transport whose eth_call answers come from `answers[functionName](args)`; a missing one reverts. */
function fakeChain(chain, epoch, answers) {
	const contracts = [chain.contracts.pdp, chain.contracts.fwssView, chain.contracts.filecoinPay];
	const call = (to, data) => {
		const c = contracts.find((x) => isAddressEqual(x.address, to));
		if (!c) throw new Error(`unknown contract ${to}`);
		const { functionName, args } = decodeFunctionData({ abi: c.abi, data });
		const answer = answers[functionName];
		if (!answer) throw new Error(`reverted: ${functionName}`);
		return encodeFunctionResult({ abi: c.abi, functionName, result: answer(...(args ?? [])) });
	};
	const calls = [];
	const transport = custom({
		async request({ method, params }) {
			if (method === 'eth_chainId') return numberToHex(chain.id);
			if (method === 'eth_blockNumber') return numberToHex(epoch);
			if (method !== 'eth_call') throw new Error(`unexpected ${method}`);
			const { to, data } = params[0];
			if (isAddressEqual(to, chain.contracts.multicall3.address)) {
				const { args } = decodeFunctionData({ abi: multicall3Abi, data });
				const results = args[0].map((c) => {
					try {
						calls.push(decodeFunctionData({ abi: [...chain.contracts.pdp.abi, ...chain.contracts.fwssView.abi, ...chain.contracts.filecoinPay.abi], data: c.callData }).functionName);
						return { success: true, returnData: call(c.target, c.callData) };
					} catch {
						return { success: false, returnData: '0x' };
					}
				});
				return encodeFunctionResult({ abi: multicall3Abi, functionName: 'aggregate3', result: results });
			}
			return call(to, data);
		}
	});
	return { transport, calls };
}

const dataSet = (over = {}) => ({
	pdpRailId: 70n, cacheMissRailId: 0n, cdnRailId: 0n, payer: PAYER, payee: PAYER, serviceProvider: PAYER, commissionBps: 0n,
	clientDataSetId: 1n, pdpEndEpoch: 0n, providerId: 9n, pendingOneTimePayments: 0n, lifecycleReserveBalance: 0n, dataSetId: 500n, ...over
});
const rail = (over = {}) => ({
	token: TOKEN, from: PAYER, to: PAYER, operator: PAYER, validator: PAYER, paymentRate: 10n, lockupPeriod: 30n * DAY, lockupFixed: 0n,
	settledUpTo: 0n, endEpoch: 0n, commissionRateBps: 0n, serviceFeeRecipient: PAYER, ...over
});

// A healthy copy on a mainnet-like chain: activated 10 days ago, proven in
// every period, next challenge tomorrow, the account covers 90 more days.
const NOW = 1_000_000n;
const ACT = NOW - 10n * DAY - 100n;
const healthy = (over = {}) => ({
	dataSetLive: () => true,
	pieceLive: () => true,
	getDataSetLastProvenEpoch: () => NOW - 500n,
	getNextChallengeEpoch: () => NOW + DAY - 200n,
	provingDeadline: () => ACT + 11n * DAY,
	provenThisPeriod: () => false,
	provingActivationEpoch: () => ACT,
	getPDPConfig: () => [Number(DAY), 60n, 5n, 0n],
	getDataSet: () => dataSet(),
	provenPeriods: () => true,
	getRail: () => rail(),
	// funds - lockup = 90 days at a rate of 1 per epoch
	accounts: () => [1000n + 90n * DAY, 1000n, 1n, NOW],
	...over
});

const check = (answers, { chain = mainnet, copies = [{ providerId: '9', dataSetId: '500', pieceIds: ['3', '4'], place: 'Land 9' }] } = {}) => {
	const fake = fakeChain(chain, NOW, answers);
	return checkBackupOnChain({ network: chain === mainnet ? 'mainnet' : 'calibration', copies, transport: fake.transport }).then((r) => ({ result: r, calls: fake.calls }));
};
const light = (copy, id) => copy.lights.find((l) => l.id === id);

describe('endedPeriods', () => {
	it('lists the proving periods whose deadline passed, as Warm Storage numbers them', () => {
		// Activated at 1000, length 100: period 0 is epochs 1001–1100, deadline 1100.
		expect(endedPeriods(1000n, 100n, 1100n)).toEqual([]);
		expect(endedPeriods(1000n, 100n, 1101n)).toEqual([0n]);
		expect(endedPeriods(1000n, 100n, 1350n)).toEqual([0n, 1n, 2n]);
		expect(endedPeriods(1000n, 100n, 1000n + 100n * 50n + 1n, 30)).toHaveLength(30);
		expect(endedPeriods(0n, 100n, 5000n)).toEqual([]);
	});
});

describe('checkBackupOnChain (mocked RPC answers)', () => {
	it('a healthy copy: every light green, read from the chain', async () => {
		const { result, calls } = await check(healthy());
		expect(result).toHaveLength(1);
		const [copy] = result;
		expect(copy).toMatchObject({ providerId: '9', dataSetId: '500', place: 'Land 9', state: 'app', error: null });
		expect(copy.lights.map((l) => [l.id, l.state, l.note])).toEqual([
			['dataSet', 'app', 'live'],
			['lastProof', 'app', 'recent'],
			['nextChallenge', 'app', 'scheduled'],
			['faults', 'app', 'none'],
			['paid', 'app', 'until']
		]);
		expect(light(copy, 'dataSet').count).toBe(2);
		expect(light(copy, 'lastProof')).toMatchObject({ epoch: String(NOW - 500n), at: epochTime(NOW - 500n, mainnet.genesisTimestamp) });
		expect(light(copy, 'faults')).toMatchObject({ count: 0, of: 10 });
		expect(light(copy, 'paid')).toMatchObject({ epoch: String(NOW + 90n * DAY), count: 30 });
		// The pieces of this backup were asked for, one by one, and nothing was written.
		expect(calls.filter((c) => c === 'pieceLive')).toHaveLength(2);
		expect(calls.every((c) => /^(get|data|piece|proven|proving|accounts)/.test(c))).toBe(true);
	});

	it('a data set the verifier no longer has is red', async () => {
		const { result: [copy] } = await check(healthy({ dataSetLive: () => false, getNextChallengeEpoch: undefined }));
		expect(light(copy, 'dataSet')).toMatchObject({ state: 'failed', note: 'notLive' });
		expect(light(copy, 'nextChallenge')).toMatchObject({ state: 'off', note: 'none' });
		expect(copy.state).toBe('failed');
	});

	it('a piece of the backup removed from the data set is red', async () => {
		const { result: [copy] } = await check(healthy({ pieceLive: (_, piece) => piece !== 4n }));
		expect(light(copy, 'dataSet')).toMatchObject({ state: 'failed', note: 'piecesGone', count: 1, of: 2 });
	});

	it('missed proving periods are counted as faults', async () => {
		const { result: [copy] } = await check(healthy({ provenPeriods: (_, period) => period !== 3n && period !== 7n }));
		expect(light(copy, 'faults')).toMatchObject({ state: 'failed', note: 'missed', count: 2, of: 10 });
	});

	it('a deadline that passed without a proof is overdue, and an old last proof is red', async () => {
		const { result: [copy] } = await check(healthy({ provingDeadline: () => NOW - 10n, getDataSetLastProvenEpoch: () => NOW - 3n * DAY, getNextChallengeEpoch: () => NOW - 40n }));
		expect(light(copy, 'nextChallenge')).toMatchObject({ state: 'failed', note: 'overdue', epoch: String(NOW - 10n) });
		expect(light(copy, 'lastProof')).toMatchObject({ state: 'failed', note: 'old' });
	});

	it('a live data set with pieces but no challenge scheduled is red', async () => {
		const { result: [copy] } = await check(healthy({ getNextChallengeEpoch: () => 0n }));
		expect(light(copy, 'nextChallenge')).toMatchObject({ state: 'failed', note: 'none' });
	});

	it('an ended service and an ended rail are red', async () => {
		const { result: [copy] } = await check(healthy({ getDataSet: () => dataSet({ pdpEndEpoch: NOW + DAY }), getRail: () => rail({ endEpoch: NOW + DAY }) }));
		expect(light(copy, 'dataSet')).toMatchObject({ state: 'failed', note: 'ending' });
		expect(light(copy, 'paid')).toMatchObject({ state: 'failed', note: 'railEnded', epoch: String(NOW + DAY) });
	});

	it('an account that no longer covers its lockups is red', async () => {
		const { result: [copy] } = await check(healthy({ accounts: () => [1000n, 1000n, 1n, NOW - 10n] }));
		expect(light(copy, 'paid')).toMatchObject({ state: 'failed', note: 'runOut' });
	});

	it('what the chain did not answer stays dark, never green', async () => {
		const { result: [copy] } = await check(healthy({ getRail: undefined, getDataSetLastProvenEpoch: undefined, provenPeriods: undefined }));
		expect(light(copy, 'paid')).toMatchObject({ state: 'off', note: 'unread' });
		expect(light(copy, 'lastProof')).toMatchObject({ state: 'off', note: 'unread' });
		expect(light(copy, 'faults')).toMatchObject({ state: 'off', note: 'unread' });
		expect(copy.state).toBe('off');
	});

	it('a node that does not answer at all gives an error, no lights', async () => {
		const transport = custom({ request: async () => { throw new Error('node down'); } });
		const [copy] = await checkBackupOnChain({ network: 'calibration', copies: [{ providerId: '2', dataSetId: '7' }], transport });
		expect(copy).toMatchObject({ state: 'off', lights: [], error: expect.stringContaining('node down') });
	});

	it('leaves out copies whose data set the list does not name, and reads Calibration too', async () => {
		const { result } = await check(healthy(), { chain: calibration, copies: [{ providerId: '2', dataSetId: '8' }, { providerId: '9' }] });
		expect(result.map((c) => c.dataSetId)).toEqual(['8']);
		expect(light(result[0], 'dataSet')).toMatchObject({ state: 'app', note: 'liveSet' });
	});
});

describe('copyState', () => {
	const base = { epoch: 100n, live: true, piecesLive: [true], lastProven: 90n, nextChallenge: 150n, deadline: 160n, provenThisPeriod: false, activation: 0n, maxProvingPeriod: 60n, periods: [], info: null, rail: null, account: null };
	it('proving not started: no faults to count, nothing green about it', () => {
		const { lights } = copyState(base, { genesis: 0 });
		expect(lights.find((l) => l.id === 'faults')).toMatchObject({ state: 'off', note: 'notStarted' });
	});
	it('a rail without a rate: paid, without a date', () => {
		const { lights } = copyState({ ...base, rail: { token: TOKEN, from: PAYER, paymentRate: 0n, lockupPeriod: 0n, endEpoch: 0n }, account: { funds: 0n, lockupCurrent: 0n, lockupRate: 0n, lockupLastSettledAt: 0n } }, { genesis: 0 });
		expect(lights.find((l) => l.id === 'paid')).toMatchObject({ state: 'app', note: 'noRate' });
	});
	it('epochs are 30 seconds after genesis', () => {
		expect(epochTime(2n, 1000)).toBe(1_060_000);
	});
});

describe('sampleFetch', () => {
	const url = 'https://sp.example.com/piece/bafkzcibmadeup';
	it('a provider that sends bytes is only reported, never green', async () => {
		const fetch = async (_u, init) => {
			expect(init.headers.Range).toBe('bytes=0-1023');
			return new Response(new Uint8Array(1024), { status: 206 });
		};
		expect(await sampleFetch(url, { fetch })).toEqual({ state: 'reported', note: 'answers', status: 206, bytes: 1024 });
	});
	it('an error status is red, an unreachable provider dark', async () => {
		expect(await sampleFetch(url, { fetch: async () => new Response('', { status: 404 }) })).toEqual({ state: 'failed', note: 'status', status: 404 });
		expect(await sampleFetch(url, { fetch: async () => { throw new TypeError('Failed to fetch'); } })).toEqual({ state: 'off', note: 'silent' });
		expect(await sampleFetch('http://sp.example.com/piece/x', { fetch: async () => { throw new Error('not called'); } })).toEqual({ state: 'off', note: 'silent' });
	});
});

describe('pdpExplorer', () => {
	it('links a data set by its number and a piece by its CID, per network', () => {
		expect(pdpExplorer.dataSet('mainnet', 500n)).toBe('https://pdp.filecoin.cloud/mainnet/dataset/500');
		expect(pdpExplorer.dataSet('calibration', '7')).toBe('https://pdp.filecoin.cloud/calibration/dataset/7');
		expect(pdpExplorer.piece('mainnet', 'bafkzcibmadeup')).toBe('https://pdp.filecoin.cloud/mainnet/piece/bafkzcibmadeup');
	});
});
