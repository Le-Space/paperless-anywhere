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
