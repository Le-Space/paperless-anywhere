// The paying account's balances and how long they last, read-only from public
// endpoints (no wallet prompt): Aleph credits for the VMs, and on Filecoin the
// gas, the USDFC in the wallet and the Filecoin Pay deposit the backups draw on.
import { createPublicClient, formatUnits, http } from 'viem';
import { getAccountSummary } from '@filoz/synapse-core/pay';
import { balance as erc20Balance } from '@filoz/synapse-core/erc20';
import { ALEPH_API } from './aleph.js';
import { filecoinChain } from './permissions.js';

// A running Paperless (confidential, 2 vCPU, 4 GB, 40 GiB rootfs) as of
// 2026-10-29, for when Aleph's price list cannot be read.
export const PAPERLESS_CREDITS_PER_HOUR = 57_000;
// Aleph's price list: an aggregate of this address under the key `pricing`.
const PRICING_ADDRESS = '0xFba561a84A537fCaa567bb7A2257e7142701ae2A';
// Aleph accepts a VM only when the account holds a day of everything it then
// pays for: the new VM and what already runs (error 6, min_runtime_days: 1).
export const RESERVE_HOURS = 24;
// Gas for a session-key renewal or a deposit; below this the setup warns.
export const LOW_GAS = 0.05;
const EPOCH_SECONDS = 30;

/** @param {string} payer @returns {Promise<{ credits: number, aleph: number }>} */
export async function alephBalance(payer) {
	const res = await fetch(`${ALEPH_API}/api/v0/addresses/${payer}/balance`, { cache: 'no-store' });
	if (res.status === 404) return { credits: 0, aleph: 0 };
	if (!res.ok) throw new Error(`Aleph answered ${res.status}`);
	const body = await res.json();
	return { credits: Number(body?.credit_balance ?? 0), aleph: Number(body?.balance ?? 0) };
}

/**
 * @param {string} network @param {string} payer
 * @returns {Promise<{ gas: number, usdfc: number, deposit: number, available: number, perMonth: number, runwayDays: number | null }>}
 */
export async function filecoinBalance(network, payer) {
	const client = createPublicClient({ chain: filecoinChain(network), transport: http(undefined, { retryCount: 1, timeout: 15_000 }) });
	const address = /** @type {`0x${string}`} */ (payer);
	const [gas, usdfc, pay] = await Promise.all([client.getBalance({ address }), erc20Balance(client, { address }), getAccountSummary(client, { address })]);
	const days = pay.lockupRatePerEpoch > 0n ? Number(pay.runwayInEpochs) * EPOCH_SECONDS / 86_400 : null;
	return {
		gas: Number(formatUnits(gas, 18)),
		usdfc: Number(formatUnits(usdfc.value, usdfc.decimals)),
		deposit: Number(formatUnits(pay.funds, 18)),
		available: Number(formatUnits(pay.availableFunds, 18)),
		perMonth: Number(formatUnits(pay.lockupRatePerMonth, 18)),
		runwayDays: days === null ? null : Math.floor(days)
	};
}

/**
 * Credits per hour of a confidential VM of this size, from Aleph's price list:
 * compute units (1 vCPU and 2 GiB each, the larger count wins, rounded up to a
 * tier) at the confidential price, plus the rootfs beyond what the units
 * include. Falls back to the price of 2026-10-29 when the list is unreadable.
 * @param {{ vcpus: number, memoryMiB: number, rootfsSizeMiB: number }} vm
 */
export async function confidentialCreditsPerHour(vm) {
	try {
		const res = await fetch(`${ALEPH_API}/api/v0/aggregates/${PRICING_ADDRESS}.json?keys=pricing`, { cache: 'no-store' });
		if (!res.ok) throw new Error(`Aleph answered ${res.status}`);
		return priceFromList((await res.json())?.data?.pricing?.instance_confidential, vm);
	} catch {
		return PAPERLESS_CREDITS_PER_HOUR;
	}
}

/** @param {any} entry the `instance_confidential` entry of Aleph's price list @param {{ vcpus: number, memoryMiB: number, rootfsSizeMiB: number }} vm */
export function priceFromList(entry, vm) {
	const unit = entry?.compute_unit;
	const perUnit = Number(entry?.price?.compute_unit?.credit);
	const perMiB = Number(entry?.price?.storage?.credit ?? 0);
	if (!unit?.vcpus || !unit?.memory_mib || !(perUnit > 0)) throw new Error('no confidential price in the list');
	const needed = Math.max(Math.ceil(vm.vcpus / unit.vcpus), Math.ceil(vm.memoryMiB / unit.memory_mib));
	const tier = (entry.tiers ?? []).map((t) => Number(t.compute_units)).filter((n) => n >= needed).sort((a, b) => a - b)[0] ?? needed;
	const extraMiB = Math.max(0, vm.rootfsSizeMiB - tier * Number(unit.disk_mib ?? 0));
	return Math.round(tier * perUnit + extraMiB * perMiB);
}

/**
 * Credits per hour the account already spends: its running VMs and stored
 * files, as Aleph charges them now.
 * @param {string} payer
 */
export async function runningCreditsPerHour(payer) {
	const res = await fetch(`${ALEPH_API}/api/v0/costs?address=${payer}&payment_type=credit`, { cache: 'no-store' });
	if (!res.ok) throw new Error(`Aleph answered ${res.status}`);
	return Math.round(Number((await res.json())?.summary?.total_cost_credit ?? 0) * 3600);
}

/** Hours the credits last at this spend. @param {number} credits @param {number} perHour */
export const hoursOf = (credits, perHour) => (perHour > 0 ? Math.floor(credits / perHour) : 0);

/** "3 Tage 4 h" / "5 h" for a number of hours. @param {number} hours */
export function duration(hours) {
	if (hours < 48) return `${hours} h`;
	return `${Math.floor(hours / 24)} Tage${hours % 24 ? ` ${hours % 24} h` : ''}`;
}

/** "2,85" with German separators. @param {number} n @param {number} [digits] */
export const amount = (n, digits = 2) => n.toLocaleString('de-DE', { maximumFractionDigits: digits, minimumFractionDigits: n !== 0 && Math.abs(n) < 1 ? Math.min(digits, 2) : 0 });
