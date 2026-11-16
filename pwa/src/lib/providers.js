// Where backups go: the approved storage providers, and the same choice the
// backup tool (paperless-backup-filecoin) makes from `copies`, `providerIds`
// and `regions`, so the setup can show it before the VM does it.
import { createPublicClient, formatUnits, http } from 'viem';
import { getAccountTotalStorageSize, getApprovedProviderIds, getPriceList } from '@filoz/synapse-core/warm-storage';
import { getEndorsedProviderIds } from '@filoz/synapse-core/endorsements';
import { getPDPProvidersByIds } from '@filoz/synapse-core/sp-registry';
import { filecoinChain } from './permissions.js';
import { place } from './backups.js';
import { tr } from './i18n/index.js';
import { registeredDomain, sameOperator, sharedSigns } from './operators.js';

const EU = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'];
const EEA = [...EU, 'IS', 'LI', 'NO'];
export const REGION_PRESETS = { EU, EEA, EUROPE: [...EEA, 'GB', 'CH'] };

/** @typedef {{ id: number, name: string, location: string, place: string, country: string | null, operator: string | null, endorsed: boolean, active: boolean, owner?: string | null, payee?: string | null, url?: string | null }} Provider operator: the registered domain of the service URL; owner, payee: the registry's addresses (operators.js) */
const countryOf = (location) => /(?:^|;)C=([A-Z]{2})/i.exec(location ?? '')?.[1]?.toUpperCase() ?? null;

/** The approved providers, endorsed first. @param {string} network @returns {Promise<Provider[]>} */
export async function listProviders(network) {
	const client = createPublicClient({ chain: filecoinChain(network), transport: http(undefined, { retryCount: 1, timeout: 20_000 }) });
	const ids = [];
	let cursor;
	do {
		const page = await getApprovedProviderIds(client, cursor === undefined ? {} : { cursor });
		ids.push(...page.items);
		cursor = page.nextCursor;
	} while (cursor !== undefined && cursor !== null);
	const endorsed = new Set([...(await getEndorsedProviderIds(client))].map(Number));
	const providers = await getPDPProvidersByIds(client, { providerIds: ids });
	return providers
		.map((p) => ({
			id: Number(p.id),
			name: p.name,
			location: p.pdp?.location ?? '',
			place: place(p.pdp?.location),
			country: countryOf(p.pdp?.location),
			operator: registeredDomain(p.pdp?.serviceURL),
			owner: p.serviceProvider ?? null,
			payee: p.payee ?? null,
			url: p.pdp?.serviceURL ?? null,
			endorsed: endorsed.has(Number(p.id)),
			active: p.isActive
		}))
		.sort((a, b) => Number(b.endorsed) - Number(a.endorsed) || a.id - b.id);
}

/** Country codes for regions such as ['EUROPE'] or ['DE', 'NL']; [] = anywhere. @param {string[]} [regions] */
export const regionCodes = (regions = []) => regions.flatMap((r) => REGION_PRESETS[String(r).toUpperCase()] ?? [String(r).toUpperCase()]);

/** A provider as operators.js compares it (the domain stands in for the URL in made-up lists). @param {Provider} p */
const entry = (p) => ({ id: p.id, name: p.name, owner: p.owner, payee: p.payee, url: p.url ?? (p.operator ? `https://${p.operator}` : null) });
/** Whether two providers belong to one operator. @param {Provider} a @param {Provider} b */
export const oneOperator = (a, b) => sameOperator(entry(a), entry(b));

/**
 * The providers a backup config lands on, and what keeps it from working.
 * Copies go to different operators (operators.js): two copies at one
 * operator are not independent. Named providers of one operator are refused
 * while another operator in the region could take the copy (on Calibration
 * one operator holds every approved provider: there it is only warned of);
 * a region fills copies at operators that hold none first, and `operators`
 * says how many independent ones it found.
 * @param {Provider[]} providers @param {{ copies?: number, providerIds?: number[], regions?: string[] }} config
 * @returns {{ picked: Provider[], problems: string[], operators?: number }}
 */
export function pickProviders(providers, { copies = 2, providerIds = [], regions = [] }) {
	const codes = regionCodes(regions);
	const inRegion = (p) => !codes.length || codes.includes(p.country ?? '');
	const say = tr().backup.places.problems;
	if (providerIds.length) {
		const byId = new Map(providers.map((p) => [p.id, p]));
		const problems = [];
		const picked = [];
		for (const id of providerIds) {
			const p = byId.get(id);
			// A second copy at one operator is refused while another operator could take it.
			const twin = p && picked.find((q) => oneOperator(q, p));
			const elsewhere = twin && providers.some((o) => o.active && inRegion(o) && !providerIds.includes(o.id) && ![...picked, p].some((q) => oneOperator(q, o)));
			if (!p) problems.push(say.notApproved(id));
			else if (!p.active) problems.push(say.notActive(id, p.name));
			else if (!inRegion(p)) problems.push(say.outsideRegion(id, p.name));
			else if (twin && elsewhere) problems.push(say.sameOperator(id, p.name, twin.name, signsText(twin, p)));
			else picked.push(p);
		}
		return { picked, problems };
	}
	const candidates = providers.filter((p) => p.active && inRegion(p));
	// One copy per operator, endorsed first (the list's order). Never a second
	// copy at an operator while another one in the region holds none; only
	// when the region has fewer operators than copies, the rest goes to an
	// operator that has one, at another place first (sharedWarnings says so).
	const picked = [];
	for (const p of candidates) if (picked.length < copies && !picked.some((q) => oneOperator(q, p))) picked.push(p);
	const operators = picked.length;
	for (const p of candidates) if (picked.length < copies && !picked.includes(p) && !picked.some((q) => q.place && q.place === p.place)) picked.push(p);
	for (const p of candidates) if (picked.length < copies && !picked.includes(p)) picked.push(p);
	const problems = candidates.length < copies ? [say.tooFew(copies, candidates.length)] : [];
	return { picked, problems, operators };
}

/**
 * Where one more copy could go: the first active provider at none of the
 * picked ones' operators, in the region if there is one there, else anywhere
 * (`inRegion` says which). Null when every operator already holds a copy.
 * @param {Provider[]} providers @param {Provider[]} picked @param {string[]} [regions]
 * @returns {{ provider: Provider, inRegion: boolean } | null}
 */
export function independentCandidate(providers, picked, regions = []) {
	const codes = regionCodes(regions);
	const free = providers.filter((p) => p.active && !picked.some((q) => oneOperator(q, p)));
	const here = free.find((p) => !codes.length || codes.includes(p.country ?? ''));
	if (here) return { provider: here, inRegion: true };
	return free[0] ? { provider: free[0], inRegion: false } : null;
}

/** What two providers share, in words ("Domain fidl.tech"). @param {Provider} a @param {Provider} b */
export function signsText(a, b) {
	const say = tr().backup.places.signs;
	return sharedSigns(entry(a), entry(b)).map((s) => say[s.kind](s.value)).join(', ');
}

/** The countries outside the EU among the picked providers ('??' without a declared country). @param {Provider[]} picked */
export const outsideEu = (picked) => [...new Set(picked.filter((p) => !EU.includes(p.country ?? '')).map((p) => p.country ?? '??'))];

/** Warnings when copies are not independent: same operator or same place. @param {Provider[]} picked */
export function sharedWarnings(picked) {
	const warnings = [];
	const say = tr().backup.places.shared;
	for (let i = 0; i < picked.length; i++) {
		for (let j = i + 1; j < picked.length; j++) {
			const [a, b] = [picked[i], picked[j]];
			if (oneOperator(a, b)) warnings.push(say.operator(a.name, b.name, signsText(a, b)));
			else if (a.place && a.place === b.place) warnings.push(say.place(a.name, b.name, a.place));
		}
	}
	return warnings;
}

/** USDFC per month and data set, from the warm storage price list. @param {string} network */
export async function storagePrices(network) {
	const client = createPublicClient({ chain: filecoinChain(network), transport: http(undefined, { retryCount: 1, timeout: 15_000 }) });
	const { rates } = await getPriceList(client);
	return { perTibMonth: Number(formatUnits(rates.storagePerTibPerMonth, 18)), perDataSetMonth: Number(formatUnits(rates.datasetFeePerMonth, 18)) };
}

/** USDFC per month for `copies` copies of `bytes`. @param {{ perTibMonth: number, perDataSetMonth: number }} prices @param {number} copies @param {number} bytes */
export const monthlyCost = (prices, copies, bytes) => copies * (prices.perDataSetMonth + (bytes / 2 ** 40) * prices.perTibMonth);

/** What one copy holds today: the owner's stored bytes per data set (0 without any). @param {string} network @param {string} owner */
export async function bytesPerCopy(network, owner) {
	const client = createPublicClient({ chain: filecoinChain(network), transport: http(undefined, { retryCount: 1, timeout: 15_000 }) });
	const { totalSizeBytes, datasetCount } = await getAccountTotalStorageSize(client, { address: /** @type {`0x${string}`} */ (owner) });
	return datasetCount ? Number(totalSizeBytes) / datasetCount : 0;
}

/** A provider's address in the Filfox explorer. @param {string} network @param {string} address */
export const explorerUrl = (network, address) => `https://${network === 'mainnet' ? '' : 'calibration.'}filfox.info/en/address/${address}`;

/** Provider ids named in the VM's backup lines ("service provider 43"). @param {string[]} lines */
export const providerIdsIn = (lines) => [...new Set(lines.flatMap((l) => [...String(l).matchAll(/(?:service )?provider (\d+)/gi)].map((m) => Number(m[1]))))];

/**
 * Whether providers answer right now: their public PDP ping (CORS open),
 * with the time it took. Answering means reachable, not that an upload
 * will be taken.
 * @param {string} network @param {number[]} ids
 * @param {{ fetch?: typeof fetch, timeoutMs?: number, client?: any }} [options]
 * @returns {Promise<{ id: number, name: string, place: string, url: string, explorer: string, ok: boolean, status: number | null, ms: number | null }[]>}
 */
export async function providerHealth(network, ids, { fetch: fetchImpl = fetch, timeoutMs = 8000, client } = {}) {
	if (!ids.length) return [];
	const c = client ?? createPublicClient({ chain: filecoinChain(network), transport: http(undefined, { retryCount: 1, timeout: 20_000 }) });
	const providers = await getPDPProvidersByIds(c, { providerIds: ids.map(BigInt) });
	return Promise.all(
		providers.map(async (p) => {
			const url = String(p.pdp?.serviceURL ?? '').replace(/\/+$/, '');
			const base = { id: Number(p.id), name: p.name, place: place(p.pdp?.location), url, explorer: explorerUrl(network, p.serviceProvider) };
			if (!/^https:\/\//.test(url)) return { ...base, ok: false, status: null, ms: null };
			const t0 = performance.now();
			try {
				const res = await fetchImpl(`${url}/pdp/ping`, { cache: 'no-store', signal: AbortSignal.timeout(timeoutMs) });
				return { ...base, ok: res.ok, status: res.status, ms: Math.round(performance.now() - t0) };
			} catch {
				return { ...base, ok: false, status: null, ms: null };
			}
		})
	);
}
