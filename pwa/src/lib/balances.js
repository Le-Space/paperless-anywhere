// The paying account's balances and how long they last, read-only from public
// endpoints (no wallet prompt): Aleph credits for the VMs, and on Filecoin the
// gas, the USDFC in the wallet and the Filecoin Pay deposit the backups draw on.
import { createPublicClient, formatUnits, http } from 'viem';
import { getAccountSummary } from '@filoz/synapse-core/pay';
import { balance as erc20Balance } from '@filoz/synapse-core/erc20';
import { ALEPH_API } from './aleph.js';
import { filecoinChain } from './permissions.js';

// A running Paperless (confidential, 2 vCPU, 4 GB, 10 GiB rootfs + 40 GiB data
// disk), from Aleph's price estimate on 2026-10-25.
export const PAPERLESS_CREDITS_PER_HOUR = 58_840;
// Aleph accepts a VM only with a day of its price in hand (error 6, min_runtime_days: 1).
export const RESERVE_CREDITS = 24 * PAPERLESS_CREDITS_PER_HOUR;
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

/** Hours of a running Paperless the credits pay for. @param {number} credits */
export const hoursOf = (credits) => Math.floor(credits / PAPERLESS_CREDITS_PER_HOUR);

/** "3 Tage 4 h" / "5 h" for a number of hours. @param {number} hours */
export function duration(hours) {
	if (hours < 48) return `${hours} h`;
	return `${Math.floor(hours / 24)} Tage${hours % 24 ? ` ${hours % 24} h` : ''}`;
}

/** "2,85" with German separators. @param {number} n @param {number} [digits] */
export const amount = (n, digits = 2) => n.toLocaleString('de-DE', { maximumFractionDigits: digits, minimumFractionDigits: n !== 0 && Math.abs(n) < 1 ? Math.min(digits, 2) : 0 });
