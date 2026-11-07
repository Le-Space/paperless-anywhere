// Where backups go: the approved storage providers, and the same choice the
// backup tool (paperless-backup-filecoin) makes from `copies`, `providerIds`
// and `regions`, so the setup can show it before the VM does it.
import { createPublicClient, formatUnits, http } from 'viem';
import { getAccountTotalStorageSize, getApprovedProviderIds, getPriceList } from '@filoz/synapse-core/warm-storage';
import { getEndorsedProviderIds } from '@filoz/synapse-core/endorsements';
import { getPDPProvidersByIds } from '@filoz/synapse-core/sp-registry';
import { filecoinChain } from './permissions.js';
import { place } from './backups.js';

const EU = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'];
const EEA = [...EU, 'IS', 'LI', 'NO'];
export const REGION_PRESETS = { EU, EEA, EUROPE: [...EEA, 'GB', 'CH'] };

/** @typedef {{ id: number, name: string, location: string, place: string, country: string | null, operator: string | null, endorsed: boolean, active: boolean }} Provider */

const operatorOf = (url) => {
	try {
		return new URL(url).hostname.split('.').slice(-2).join('.');
	} catch {
		return null;
	}
};
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
			operator: operatorOf(p.pdp?.serviceURL),
			endorsed: endorsed.has(Number(p.id)),
			active: p.isActive
		}))
		.sort((a, b) => Number(b.endorsed) - Number(a.endorsed) || a.id - b.id);
}

/** Country codes for regions such as ['EUROPE'] or ['DE', 'NL']; [] = anywhere. @param {string[]} [regions] */
export const regionCodes = (regions = []) => regions.flatMap((r) => REGION_PRESETS[String(r).toUpperCase()] ?? [String(r).toUpperCase()]);

/**
 * The providers a backup config lands on, as the backup tool picks them, and
 * what keeps it from working.
 * @param {Provider[]} providers @param {{ copies?: number, providerIds?: number[], regions?: string[] }} config
 * @returns {{ picked: Provider[], problems: string[] }}
 */
export function pickProviders(providers, { copies = 2, providerIds = [], regions = [] }) {
	const codes = regionCodes(regions);
	const inRegion = (p) => !codes.length || codes.includes(p.country ?? '');
	if (providerIds.length) {
		const byId = new Map(providers.map((p) => [p.id, p]));
		const problems = [];
		const picked = [];
		for (const id of providerIds) {
			const p = byId.get(id);
			if (!p) problems.push(`Anbieter ${id} ist nicht (mehr) zugelassen.`);
			else if (!p.active) problems.push(`Anbieter ${id} (${p.name}) ist nicht aktiv.`);
			else if (!inRegion(p)) problems.push(`Anbieter ${id} (${p.name}) liegt außerhalb der Region.`);
			else picked.push(p);
		}
		return { picked, problems };
	}
	const candidates = providers.filter((p) => p.active && inRegion(p));
	// One copy per operator first, then per country, then whatever is left.
	const picked = [];
	for (const p of candidates) if (!picked.some((q) => q.operator === p.operator)) picked.push(p);
	for (const p of candidates) if (!picked.includes(p) && !picked.some((q) => q.country === p.country)) picked.push(p);
	for (const p of candidates) if (!picked.includes(p)) picked.push(p);
	const problems = candidates.length < copies ? [`${copies} Kopien gewünscht, in der Region gibt es nur ${candidates.length} zugelassene Anbieter.`] : [];
	return { picked: picked.slice(0, copies), problems };
}

/** The countries outside the EU among the picked providers ('??' without a declared country). @param {Provider[]} picked */
export const outsideEu = (picked) => [...new Set(picked.filter((p) => !EU.includes(p.country ?? '')).map((p) => p.country ?? '??'))];

/** Warnings when copies are not independent: same operator or same place. @param {Provider[]} picked */
export function sharedWarnings(picked) {
	const warnings = [];
	for (let i = 0; i < picked.length; i++) {
		for (let j = i + 1; j < picked.length; j++) {
			const [a, b] = [picked[i], picked[j]];
			if (a.operator && a.operator === b.operator) warnings.push(`${a.name} und ${b.name} gehören demselben Betreiber (${a.operator}).`);
			else if (a.place && a.place === b.place) warnings.push(`${a.name} und ${b.name} stehen am selben Ort (${a.place}).`);
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
