// The daily watch over the storage providers (src/lib/provider-watch.js says
// what it reports). Reads only public data: the Filecoin mainnet contracts
// over the public RPC, and each provider's PDP ping. No key, no payment.
//
//   node scripts/provider-watch.mjs [state.json]
//
// With GITHUB_TOKEN and GITHUB_REPOSITORY set, it opens and closes the
// issues; without them it only prints what it would do. The state is read
// from and written back to the file named (default: provider-watch-state.json).
import { readFile, writeFile } from 'node:fs/promises';
import { createPublicClient, http } from 'viem';
import { multicall, readContract } from 'viem/actions';
import { getPDPProvidersByIds } from '@filoz/synapse-core/sp-registry';
import { filecoinChain } from '../src/lib/permissions.js';
import { listProviders, providerHealth } from '../src/lib/providers.js';
import { registeredDomain } from '../src/lib/operators.js';
import { BLOCKED_PROVIDERS } from '../src/lib/blocked-providers.js';
import { copyState, readCopy } from '../src/lib/backup-chain.js';
import { assess, LABEL, syncIssues, watched } from '../src/lib/provider-watch.js';

const NETWORK = 'mainnet';
/** The newest data sets looked at for proofs, and how many per provider are read. */
const SCAN = 600;
const PER_PROVIDER = 3;
const STATE = process.argv[2] ?? 'provider-watch-state.json';

const chain = filecoinChain(NETWORK);
const client = createPublicClient({ chain, transport: http(undefined, { retryCount: 2, timeout: 30_000 }) });

/** Each id's ping, three tries a minute apart for those that do not answer. @param {number[]} ids */
async function pings(ids) {
	/** @type {Record<string, boolean>} */
	const ok = {};
	let left = ids;
	for (let round = 0; round < 3 && left.length; round++) {
		if (round) await new Promise((r) => setTimeout(r, 60_000));
		for (const h of await providerHealth(NETWORK, left, { client, timeoutMs: 15_000 })) ok[h.id] = h.ok;
		left = left.filter((id) => !ok[id]);
	}
	return ok;
}

/**
 * Per provider (by its registry address), how many of its newest live data
 * sets that are not ending miss their proofs (copyState: the last proof older
 * than two periods, or the deadline passed unproven).
 * @param {Array<{ id: number, owner?: string | null }>} providers
 */
async function proofs(providers) {
	const { pdp } = chain.contracts;
	const next = /** @type {bigint} */ (await readContract(client, { address: pdp.address, abi: pdp.abi, functionName: 'getNextDataSetId' }));
	const ids = Array.from({ length: SCAN }, (_, i) => next - 1n - BigInt(i)).filter((x) => x > 0n);
	const call = (/** @type {string} */ functionName, /** @type {bigint} */ id) => ({ address: pdp.address, abi: pdp.abi, functionName, args: [id] });
	const r = await multicall(client, { allowFailure: true, contracts: ids.flatMap((id) => [call('dataSetLive', id), call('getDataSetStorageProvider', id)]) });
	/** @type {Map<string, bigint[]>} */
	const byOwner = new Map();
	ids.forEach((id, i) => {
		const owner = /** @type {any} */ (r[2 * i + 1].result)?.[0];
		if (r[2 * i].result === true && owner) byOwner.set(owner.toLowerCase(), [...(byOwner.get(owner.toLowerCase()) ?? []), id]);
	});
	/** @type {Record<string, { checked: number, late: number }>} */
	const out = {};
	for (const p of providers) {
		const sets = byOwner.get(String(p.owner ?? '').toLowerCase()) ?? [];
		let checked = 0;
		let late = 0;
		for (const id of sets) {
			if (checked >= PER_PROVIDER) break;
			const lights = copyState(await readCopy(client, { dataSetId: id }), { genesis: /** @type {any} */ (chain).genesisTimestamp }).lights;
			const light = (/** @type {string} */ k) => lights.find((l) => l.id === k);
			// Ending, not live, or holding nothing to prove: says nothing about the provider.
			if (light('dataSet')?.state !== 'app' || light('nextChallenge')?.note === 'none') continue;
			checked++;
			if (light('lastProof')?.note === 'old' || light('nextChallenge')?.note === 'overdue') late++;
		}
		out[p.id] = { checked, late };
	}
	return out;
}

/** The blocked providers as the registry lists them, with their ping. */
async function blocked() {
	const ids = Object.keys(BLOCKED_PROVIDERS[NETWORK] ?? {}).map(Number);
	if (!ids.length) return [];
	const listed = await getPDPProvidersByIds(client, { providerIds: ids.map(BigInt) });
	const answers = await pings(ids);
	return listed.map((p) => ({
		id: Number(p.id),
		name: p.name,
		country: /(?:^|;)C=([A-Z]{2})/i.exec(p.pdp?.location ?? '')?.[1]?.toUpperCase() ?? null,
		operator: registeredDomain(p.pdp?.serviceURL),
		active: Boolean(p.isActive),
		answers: answers[Number(p.id)] === true
	}));
}

/** The GitHub issues of the watch, over the REST API with the workflow's token. */
function github() {
	const { GITHUB_TOKEN: token, GITHUB_REPOSITORY: repo } = process.env;
	if (!token || !repo) return null;
	const api = async (/** @type {string} */ path, /** @type {any} */ body, method = body ? 'POST' : 'GET') => {
		const res = await fetch(`https://api.github.com/repos/${repo}${path}`, {
			method,
			headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28' },
			...(body ? { body: JSON.stringify(body) } : {})
		});
		if (!res.ok) throw new Error(`GitHub ${method} ${path}: ${res.status}`);
		return res.json();
	};
	return {
		openIssues: async () => (await api(`/issues?state=open&labels=${LABEL}&per_page=100`)).filter((/** @type {any} */ i) => !i.pull_request),
		create: async (/** @type {string} */ title, /** @type {string} */ body) => (await api('/issues', { title, body, labels: [LABEL] })).number,
		close: async (/** @type {number} */ number, /** @type {string} */ comment) => {
			await api(`/issues/${number}/comments`, { body: comment });
			await api(`/issues/${number}`, { state: 'closed' }, 'PATCH');
		}
	};
}

const last = await readFile(STATE, 'utf8').then(JSON.parse).catch(() => null);
const providers = await listProviders(NETWORK);
const mine = watched(providers);
const snap = { providers, answers: await pings(mine.map((p) => p.id)), proofs: await proofs(mine), blocked: await blocked() };
const day = new Date().toISOString().slice(0, 10);
const { events, state } = assess(snap, last, day);

console.log(`${day}: ${providers.length} approved, ${mine.length} watched (${mine.map((p) => p.id).join(', ')}); ${last ? 'state read' : 'no state: taking stock only'}`);
for (const p of mine) console.log(`  ${p.id} ${p.name}: ping ${snap.answers[p.id] ? 'ok' : 'NO ANSWER'}, proofs late ${snap.proofs[p.id]?.late ?? 0}/${snap.proofs[p.id]?.checked ?? 0}`);
for (const b of snap.blocked) console.log(`  blocked ${b.id} ${b.name}: ${b.active ? 'active' : 'inactive'}, ping ${b.answers ? 'ok' : 'no answer'}, ${state.backDays[b.id]} day(s) in a row`);
for (const e of events.filter((x) => x.open)) console.log(`  event ${e.key}: ${e.title}`);

const gh = github();
if (gh) for (const d of await syncIssues(events, gh)) console.log(`  issue #${d.number} ${d.action} (${d.key})`);
else console.log('  no GITHUB_TOKEN/GITHUB_REPOSITORY: no issues touched');
await writeFile(STATE, JSON.stringify(state, null, '\t') + '\n');
