#!/usr/bin/env node
// The credits side of the "backup round trip through Le Space Credits"
// workflow (.github/workflows/roundtrip-credits.yml), with the PWA's own
// functions: the same keys, requests and VM secrets as the app, no signing of
// its own. The vault's master comes from CREDITS_TEST_VAULT_MASTER (64 hex
// characters); it and every key derived from it stay out of the log.
//
//   node scripts/roundtrip-credits.mjs address
//       the ledger address, the backup key's address, the network, the
//       balance and the terms. Spends nothing.
//   node scripts/roundtrip-credits.mjs prepare <dir>
//       network check, terms, one month of backup if none is funded, the
//       backup key authorized; writes the VM's secrets into <dir>.
//   node scripts/roundtrip-credits.mjs storage <dataSetId,...>
//       how long the providers are paid for those data sets, from the chain.
//   node scripts/roundtrip-credits.mjs revoke
//       revokes the backup key.
//
// Environment: CREDITS_TEST_VAULT_MASTER, CREDITS_URL (default
// https://credits.le-space.de), ALLOW_NETWORK (default mainnet),
// PROVIDER_IDS (e.g. "36,37"; empty: the PWA's default places),
// FILECOIN_RPC (default: the chain's public endpoint).
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createPublicClient, http } from 'viem';
import { getAccountSummary, getRail } from '@filoz/synapse-core/pay';
import { getDataSet } from '@filoz/synapse-core/warm-storage';
import { calibration, mainnet } from '@filoz/synapse-core/chains';
import {
	acceptTerms,
	backupAuthorize,
	backupKeyAddress,
	backupRevoke,
	creditsAccount,
	creditsBalance,
	creditsCatalog,
	creditsTerms,
	CREDITS_PRODUCT,
	fundBackups
} from '../src/lib/credits.js';
import { backupPrivateKey } from '../src/lib/keys/derive.js';
import { ageIdentityFromMaster, ageRecipient } from '../src/lib/keys/age.js';
import { backupConfigFor, vmBackupSecrets } from '../src/lib/backups.js';

const EPOCH_SECONDS = 30;

/** One clear line per result. */
const say = (/** @type {string} */ line) => console.log(line);

/** A GitHub output (key=value) when running in Actions. */
function output(/** @type {string} */ key, /** @type {string} */ value) {
	if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
}

function master() {
	const hex = String(process.env.CREDITS_TEST_VAULT_MASTER ?? '').trim().replace(/^0x/, '');
	if (!/^[0-9a-fA-F]{64}$/.test(hex)) throw new Error('CREDITS_TEST_VAULT_MASTER must be 64 hex characters');
	return Uint8Array.from(hex.match(/../g) ?? [], (b) => parseInt(b, 16));
}

const baseUrl = String(process.env.CREDITS_URL || 'https://credits.le-space.de').replace(/\/+$/, '');

// The PWA's functions turn a refusal into a German sentence; the run log
// also needs the service's status and code. Every request goes through here.
/** @type {{ path: string, status: number, code: string | null, error: string | null } | null} */
let lastRefusal = null;
/** @type {typeof fetch} */
const tracingFetch = async (url, init) => {
	const res = await fetch(url, init);
	if (!res.ok) {
		let body = null;
		try {
			body = await res.clone().json();
		} catch {}
		lastRefusal = { path: new URL(String(url)).pathname, status: res.status, code: body?.code ? String(body.code) : null, error: body?.error ? String(body.error) : null };
	}
	return res;
};
const options = { baseUrl, fetch: tracingFetch };

/** Run one step; on failure print the service's code and stop. */
async function step(/** @type {string} */ name, /** @type {() => Promise<any>} */ fn) {
	lastRefusal = null;
	try {
		return await fn();
	} catch (e) {
		const r = lastRefusal;
		const why = r ? `HTTP ${r.status} code ${r.code ?? '-'} on ${r.path}${r.error ? ` (${r.error})` : ''}` : e instanceof Error ? e.message : String(e);
		say(`::error::${name}: refused: ${why}`);
		if (r) say(`  the app would say: ${e instanceof Error ? e.message : String(e)}`);
		const err = new Error(`${name} failed`);
		/** @type {any} */ (err).reported = true;
		throw err;
	}
}

const past = (/** @type {string | null} */ iso) => !iso || !(Date.parse(iso) > Date.now());

function termsLine(/** @type {any} */ t) {
	return `terms: in force ${t?.current ?? 'none'}, accepted ${t?.accepted?.version ?? 'none'}${t?.due ? ' (DUE: must be accepted before funding)' : ''}${t?.pending ? `, announced ${t.pending.version}` : ''}`;
}

async function address() {
	const m = master();
	const ledger = creditsAccount(m).address;
	const backupKey = backupKeyAddress(m);
	say(`service: ${baseUrl}, product ${CREDITS_PRODUCT}`);
	say(`ledger address (book the test credits here): ${ledger}`);
	say(`backup key address (slot 0): ${backupKey}`);
	output('ledger', ledger);
	output('backup_key', backupKey);
	const catalog = await step('catalog', () => creditsCatalog(options)).catch(() => null);
	if (catalog) say(`network of the service's backups: ${catalog.network ?? 'none (backups off)'}; a backup month costs ${catalog.plans[0]?.backupMonthCredits ?? '?'} credits`);
	const balance = await step('balance', () => creditsBalance(m, options)).catch(() => null);
	if (balance) {
		say(`balance: ${balance.credits} credits free, ${balance.reserved} reserved`);
		say(termsLine(balance.terms));
		const b = balance.backup;
		say(b ? `backup: funded until ${b.fundedUntil ?? 'never'}, payer ${b.payer}, signer ${b.signer ?? '?'}, tag ${b.tag}, network ${b.network}, data sets [${b.dataSets.join(', ')}]` : 'backup: the service pays no backups (no backup block in the balance)');
	}
	return { catalog, balance };
}

async function prepare(/** @type {string} */ dir) {
	if (!dir) throw new Error('usage: prepare <dir>');
	const m = master();
	// Masked before anything else is printed.
	const key = backupPrivateKey(m);
	const identity = ageIdentityFromMaster(m);
	say(`::add-mask::${key}`);
	say(`::add-mask::${key.slice(2)}`);
	say(`::add-mask::${identity}`);
	const allow = String(process.env.ALLOW_NETWORK || 'mainnet');

	const catalog = await step('catalog', () => creditsCatalog(options));
	if (catalog?.network !== allow) {
		say(`::error::network: the service backs up on ${catalog?.network ?? 'no network'}, this run allows ${allow}`);
		process.exit(1);
	}
	const network = catalog.network;
	say(`network: ${network} (allowed: ${allow})`);

	let balance = await step('balance', () => creditsBalance(m, options));
	say(`balance before: ${balance.credits} credits free, ${balance.reserved} reserved`);
	say(termsLine(balance.terms));
	if (balance.terms.due) {
		const terms = await step('terms', () => creditsTerms(options));
		const version = terms?.current?.version;
		if (!version) throw new Error('the service publishes no terms in force');
		const r = await step('terms accept', () => acceptTerms(m, version, options));
		say(`terms: accepted ${r.version} at ${r.acceptedAt ?? '?'}`);
	} else {
		say('terms: nothing to accept');
	}

	if (!balance.backup) {
		say('::error::backup: the balance names no backup payer (backups are off at the service)');
		process.exit(1);
	}
	if (past(balance.backup.fundedUntil)) {
		const f = await step('fund 1 month', () => fundBackups(m, 1, options));
		say(`fund: 1 month for ${f.chargedCredits} credits, funded until ${f.fundedUntil}, quota ${f.quotaBytes} bytes, payer ${f.payer}, network ${f.network}`);
		output('funded', 'yes');
	} else {
		say(`fund: not needed, funded until ${balance.backup.fundedUntil}`);
		output('funded', 'no');
	}

	const backupKey = backupKeyAddress(m);
	const signer = await step('authorize', () => backupAuthorize(m, backupKey, options));
	say(`authorize: backup key ${backupKey} for payer ${signer.payer}, signer ${signer.signer}, tag ${signer.tag}, label ${signer.label}, network ${signer.network}, funded until ${signer.fundedUntil}`);
	output('backup_key_address', backupKey);
	output('funded_until', String(signer.fundedUntil ?? ''));
	if (signer.network !== network) {
		say(`::error::authorize: the service answers network ${signer.network}, its catalog said ${network}`);
		process.exit(1);
	}

	// The VM's secrets exactly as the PWA's start builds them (lifecycle.js).
	const ids = String(process.env.PROVIDER_IDS ?? '').split(',').map((s) => s.trim()).filter(Boolean).map(Number);
	const profile = {
		network,
		backupsByCredits: true,
		backupConfig: backupConfigFor(network, ageRecipient(identity), ids.length ? { providerIds: ids, copies: ids.length } : undefined)
	};
	const secrets = vmBackupSecrets(profile, { backupKey: key, signer, creditsUrl: baseUrl, product: CREDITS_PRODUCT, account: creditsAccount(m).address });
	mkdirSync(dir, { recursive: true, mode: 0o700 });
	writeFileSync(join(dir, 'backup_config.json'), secrets.backup_config, { mode: 0o600 });
	writeFileSync(join(dir, 'backup_key'), secrets.backup_key, { mode: 0o600 });
	writeFileSync(join(dir, 'age_identity'), `${identity}\n`, { mode: 0o600 });
	const c = JSON.parse(secrets.backup_config);
	say(`vm config: network ${c.network}, providers [${c.providerIds.join(', ')}], copies ${c.copies}, label ${c.datasetMetadata.app}, customer ${c.datasetMetadata.customer}, remoteSigner ${c.remoteSigner.creditsUrl} (${c.remoteSigner.product})`);
	output('network', network);
	output('role', network === 'mainnet' ? 'primary' : 'test');
	output('tag', signer.tag);
}

function epochDate(/** @type {bigint} */ epoch, /** @type {any} */ chain) {
	return new Date((chain.genesisTimestamp + Number(epoch) * EPOCH_SECONDS) * 1000).toISOString();
}

async function storage(/** @type {string} */ list) {
	const ids = String(list ?? '').split(',').map((s) => s.trim()).filter(Boolean);
	if (!ids.length || ids.some((id) => !/^\d+$/.test(id))) throw new Error('usage: storage <dataSetId,...>');
	const network = process.env.NETWORK === 'calibration' ? 'calibration' : 'mainnet';
	const chain = network === 'mainnet' ? mainnet : calibration;
	const client = createPublicClient({ chain, transport: http(process.env.FILECOIN_RPC || undefined, { retryCount: 2, timeout: 30_000 }) });
	say('storage_until reads: FWSS getDataSet(dataSetId) -> pdpRailId, pdpEndEpoch, payer, clientDataSetId, providerId;');
	say('  FilecoinPay getRail(pdpRailId) -> paymentRate, lockupPeriod, settledUpTo, endEpoch;');
	say('  FilecoinPay accounts(payer, USDFC) -> funds, lockupCurrent, lockupRate, lockupLastSettledAt (synapse-core getAccountSummary: runwayInEpochs).');
	say('  storage_until = endEpoch if the rail is terminated, else now + runway (payer in deficit after that) + lockupPeriod (what the lockup still pays); capped by pdpEndEpoch when set.');
	/** @type {Map<string, any>} */
	const summaries = new Map();
	let earliest = null;
	for (const id of ids) {
		let ds, rail;
		try {
			ds = await getDataSet(client, { dataSetId: BigInt(id) });
			if (ds) rail = await getRail(client, { railId: ds.pdpRailId });
		} catch (e) {
			say(`::error::storage_until: data set ${id}: chain read failed: ${e instanceof Error ? e.message.split('\n')[0] : String(e)}`);
			process.exitCode = 1;
			continue;
		}
		if (!ds) {
			say(`::error::storage_until: data set ${id} not found in FWSS`);
			process.exitCode = 1;
			continue;
		}
		const payer = String(ds.payer).toLowerCase();
		if (!summaries.has(payer)) summaries.set(payer, await getAccountSummary(client, { address: ds.payer }));
		const s = summaries.get(payer);
		const UNBOUNDED = 2n ** 256n - 1n;
		let until;
		let basis;
		if (rail.endEpoch > 0n) {
			until = rail.endEpoch;
			basis = 'rail terminated: endEpoch';
		} else if (s.runwayInEpochs === UNBOUNDED) {
			until = null;
			basis = 'payer lockupRate 0: unbounded';
		} else {
			until = s.epoch + s.runwayInEpochs + rail.lockupPeriod;
			basis = `runway ${s.runwayInEpochs} + lockupPeriod ${rail.lockupPeriod} epochs from ${s.epoch}`;
		}
		if (until != null && ds.pdpEndEpoch > 0n && ds.pdpEndEpoch < until) {
			until = ds.pdpEndEpoch;
			basis = 'pdpEndEpoch';
		}
		const date = until == null ? 'unbounded' : epochDate(until, chain);
		if (until != null && (earliest == null || until < earliest)) earliest = until;
		const perMonth = Number(rail.paymentRate * 86_400n * 30n / BigInt(EPOCH_SECONDS)) / 1e18;
		say(`storage_until data set ${id} (client id ${ds.clientDataSetId}, provider ${ds.providerId}, rail ${ds.pdpRailId}): ${date} [${basis}; rate ${perMonth.toFixed(6)} USDFC/month; settled up to ${epochDate(rail.settledUpTo, chain)}]`);
	}
	for (const [payer, s] of summaries) {
		say(`payer ${payer}: funds ${Number(s.funds) / 1e18} USDFC, available ${Number(s.availableFunds) / 1e18}, lockup rate ${Number(s.lockupRatePerMonth) / 1e18} USDFC/month over all its rails (shared by every customer of Le Space's payer)`);
	}
	if (earliest != null) output('storage_until', epochDate(earliest, chain));

	// What the service says the account paid for, and the data sets it signed.
	if (process.env.CREDITS_TEST_VAULT_MASTER) {
		const balance = await step('balance', () => creditsBalance(master(), options)).catch(() => null);
		if (balance?.backup) {
			say(`service: funded_until ${balance.backup.fundedUntil ?? 'never'}; client data sets signed for this account [${balance.backup.dataSets.join(', ')}]`);
			output('service_funded_until', String(balance.backup.fundedUntil ?? ''));
		}
	}
}

async function revoke() {
	const m = master();
	const key = backupKeyAddress(m);
	const r = await step('revoke', () => backupRevoke(m, key, options));
	say(`revoke: backup key ${key} ${r.revoked ? 'revoked' : 'was not authorized (already revoked)'}`);
}

const [cmd, arg] = process.argv.slice(2);
const commands = { address, prepare: () => prepare(arg), storage: () => storage(arg), revoke };
if (!(cmd in commands)) {
	console.error('usage: roundtrip-credits.mjs address | prepare <dir> | storage <dataSetId,...> | revoke');
	process.exit(2);
}
try {
	await commands[/** @type {keyof typeof commands} */ (cmd)]();
} catch (e) {
	if (!(/** @type {any} */ (e)?.reported)) say(`::error::${cmd}: ${e instanceof Error ? e.message : String(e)}`);
	process.exit(1);
}
