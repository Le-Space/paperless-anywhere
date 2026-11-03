// Start and stop, end to end, as the app's key on behalf of the payer:
//   start: measurements for the app's key, INSTANCE, node notified, 443
//   mapped, hostname, attest + unlock with every secret over the attested
//   channel, then the VM's status page until Paperless is ready.
//   stop:  a stop request over the attested channel, the VM's last backup,
//   then FORGET (the node stops and drops it).
// What a running VM needs to be stopped from another device goes into the
// sealed profile.
import { privateKeyToAccount } from 'viem/accounts';
import { confidentialTrustedExecution, unlockInstance, pinsOf } from '@le-space/attest-wasm/instance';
import { attestGuest, injectSecrets } from '@le-space/attest-wasm/ratls';
import { alephPrivateKey, filecoinSessionPrivateKey, fixedHostLabel, paperlessSecrets } from './keys/derive.js';
import { confidentialCreditsPerHour, RESERVE_HOURS, runningCreditsPerHour } from './balances.js';
import { relayTransports } from './attest-p2p.js';
import { attestRelaysFor } from './relays.js';
import { vmPayer } from './profile.js';
import { ALEPH_API, readFetch } from './aleph.js';
import { crnAddress, credits, estimateCreditsPerHour, FIXED_HOST_DOMAIN, forgetInstance, forward443, hostname, instanceMessage, mapped443, notifyNode, PAPERLESS_VM, publicAddress, sendInstance, vmStatus, eraseOnNode } from './vm.js';

/** The last backup failed; the VM stays. Carries the VM's reason and its tool's last log lines. */
export class BackupFailedError extends Error {
	constructor(reason, log) {
		super(`Die letzte Sicherung ist fehlgeschlagen; die VM bleibt. Grund: ${reason}`);
		this.name = 'BackupFailedError';
		this.log = log;
	}
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function loadWasm() {
	const wasm = await import('@le-space/attest-wasm/pkg/relay_button_attest.js');
	await wasm.default();
	return wasm;
}

// When to hand the secrets over again if the status page has not answered
// yet (normally it answers 2–6 minutes after the unlock, once the certificate
// is there), and when to give up.
const UNLOCK_AGAIN_AFTER_MS = [5 * 60_000, 12 * 60_000];
const READY_TIMEOUT_MS = 20 * 60_000;
const FIRST_LOOK_FIXED_MS = 90_000;

async function until(what, fn, { tries = 60, delayMs = 5000 } = {}) {
	for (let i = 0; i < tries; i++) {
		const value = await fn().catch(() => null);
		if (value) return value;
		await sleep(delayMs);
	}
	throw new Error(`${what}: no answer in time`);
}

/** What a start needs from the profile; throws with a reason a person can act on. */
export function startRequirements(profile) {
	const missing = [];
	// The wallet pays the VM, or only the backups when the app pays (appPays).
	if (!profile.payer && !profile.appPays) missing.push('zahlendes Konto');
	if (!profile.payer && profile.backupConfig) missing.push('Wallet für die Sicherungen');
	if (!profile.rootfsItemHash) missing.push('Paperless-Image');
	if (!profile.luksPassphrase) missing.push('Image-Passphrase');
	if (!profile.crnHash) missing.push('Knoten');
	// The guest backs up a primary to mainnet only and refuses any other network.
	if (profile.role === 'primary' && profile.network !== 'mainnet') missing.push('Netz Mainnet für die Rolle „Produktiv“');
	// …and backs up to mainnet only as a primary: a test there runs without backups.
	if (profile.backupConfig && profile.network === 'mainnet' && profile.role !== 'primary') missing.push('Rolle „Produktiv“ für Sicherungen auf Mainnet (oder Sicherungen aus)');
	return missing;
}

/**
 * @typedef {{ instanceHash: string, crnHash: string, payer: string, trustedExecution: any, restoreEntry: any, at: number }} Starting
 * A VM that was requested and is still being brought up: kept in the profile
 * as soon as Aleph has it, so a reload of the app can carry on with it.
 */

/**
 * @param {Uint8Array} master
 * @param {Record<string, any>} profile
 * @param {(p: { step: string, detail?: string, instanceHash?: string }) => void} onProgress
 * @param {{ onRequested?: (starting: Starting) => Promise<void> | void }} [options] told once Aleph has the VM
 * @returns {Promise<{ instanceHash: string, crnHash: string, host: string, trustedExecution: any }>}
 */
export async function startPaperless(master, profile, onProgress, { onRequested } = {}) {
	const missing = startRequirements(profile);
	if (missing.length) throw new Error(`Für den Start fehlt: ${missing.join(', ')}`);
	const app = privateKeyToAccount(alephPrivateKey(master));
	onProgress({ step: 'measure', detail: 'Messwerte für diesen Start berechnen' });
	const wasm = await loadWasm();
	const trustedExecution = await confidentialTrustedExecution({ wasm, owner: app.address, vcpus: PAPERLESS_VM.vcpus });

	onProgress({ step: 'instance', detail: 'VM anfordern' });
	const payer = vmPayer(profile, app.address);
	const message = await instanceMessage({ app, payer, rootfsItemHash: profile.rootfsItemHash, crnHash: profile.crnHash, trustedExecution, name: `paperless-${new Date().toISOString().slice(0, 16)}` });
	// Aleph takes the VM only when the account holds a day of the VM's price
	// plus a day of what it already pays for; checked here so an account short
	// of that hears it before Aleph refuses.
	const [balance, vmPerHour, runningPerHour] = await Promise.all([
		credits(payer),
		estimateCreditsPerHour(message).then((p) => p ?? confidentialCreditsPerHour(PAPERLESS_VM)),
		runningCreditsPerHour(payer).catch(() => 0)
	]);
	const reserve = profile.minCredits ?? RESERVE_HOURS * (vmPerHour + runningPerHour);
	if (balance < reserve) {
		const running = runningPerHour ? ` und ${runningPerHour.toLocaleString('de-DE')} Credits/h für das, was schon läuft` : '';
		throw new Error(`Zu wenig Credits auf ${profile.appPays ? 'dem Konto der App' : 'dem zahlenden Konto'}: ${balance.toLocaleString('de-DE')}. Aleph nimmt die VM erst mit einem Tag Reserve an: ${reserve.toLocaleString('de-DE')} (${vmPerHour.toLocaleString('de-DE')} Credits/h für Paperless${running}).`);
	}
	const instanceHash = await sendInstance(message);
	/** @type {Starting} */
	const starting = { instanceHash, crnHash: profile.crnHash, payer, trustedExecution, restoreEntry: profile.restoreEntry ?? null, at: Date.now() };
	await onRequested?.(starting);
	await notifyNode(await crnAddress(profile.crnHash), instanceHash);
	return bringUp(master, profile, starting, wasm, onProgress);
}

/**
 * Carry on with a start that was interrupted (the app was reloaded or closed
 * after Aleph took the VM): the steps after the request, each skipped when
 * the VM is already past it.
 * @param {Uint8Array} master
 * @param {Record<string, any>} profile with `starting`
 * @param {(p: { step: string, detail?: string, instanceHash?: string }) => void} onProgress
 */
export async function resumeStart(master, profile, onProgress) {
	/** @type {Starting} */
	const starting = profile.starting;
	if (!starting?.instanceHash) throw new Error('Es gibt keinen unterbrochenen Start.');
	onProgress({ step: 'instance', detail: 'VM bei Aleph nachsehen', instanceHash: starting.instanceHash });
	const res = await readFetch(`${ALEPH_API}/api/v0/messages/${starting.instanceHash}`, 'VM nachsehen');
	const status = res.ok ? (await res.json())?.status : null;
	if (status !== 'processed') throw new Error(`Die VM ${starting.instanceHash.slice(0, 12)} gibt es bei Aleph nicht mehr (${status ?? res.status}).`);
	return bringUp(master, { ...profile, restoreEntry: starting.restoreEntry }, starting, await loadWasm(), onProgress);
}

/**
 * From a requested VM to a ready Paperless: port 443, address, unlock, ready.
 * @param {Uint8Array} master @param {Record<string, any>} profile @param {Starting} starting @param {any} wasm
 * @param {(p: { step: string, detail?: string, instanceHash?: string }) => void} onProgress
 */
async function bringUp(master, profile, starting, wasm, onProgress) {
	const app = privateKeyToAccount(alephPrivateKey(master));
	const { instanceHash, payer, trustedExecution } = starting;
	const crnUrl = await crnAddress(starting.crnHash);

	onProgress({ step: 'network', detail: 'Port 443 und Adresse', instanceHash });
	if (!(await mapped443(crnUrl, instanceHash).catch(() => null))) {
		await forward443(app, payer, instanceHash);
		await until('port 443', () => mapped443(crnUrl, instanceHash), { tries: 60 });
		// The node restarts the VM to apply a mapping; give it a moment before the unlock.
		await sleep(15_000);
	}
	// With a DNS token, the fixed address: the VM points the name at itself and
	// gets its certificate over DNS, and Caddy answers on 443 (IPv6) and on the
	// node's port (IPv4), so `name:port` reaches it from either. Without one,
	// the instance's 2n6 name, new at every start.
	let host, name;
	const dns = {};
	if (profile.dnsToken) {
		const addr = await until('IPv4-Adresse', () => publicAddress(crnUrl, instanceHash), { tries: 30 });
		name = `${fixedHostLabel(master)}.${FIXED_HOST_DOMAIN}`;
		host = `${name}:${addr.port}`;
		Object.assign(dns, { dns_cloudflare_token: String(profile.dnsToken), https_ipv4: addr.ipv4, https_port: String(addr.port) });
	} else {
		host = name = await until('hostname', () => hostname(instanceHash), { tries: 30, delayMs: 10_000 });
	}

	const p = paperlessSecrets(master);
	const secrets = {
		...dns,
		https_hostname: name,
		paperless_role: profile.role === 'primary' ? 'primary' : 'test',
		paperless_admin_password: p.adminPassword,
		paperless_db_password: p.dbPassword,
		paperless_secret_key: p.secretKey
	};
	if (profile.backupConfig) {
		secrets.backup_config = JSON.stringify({ ...profile.backupConfig, payer: profile.payer, network: profile.network === 'mainnet' ? 'mainnet' : 'calibration' });
		secrets.backup_session_key = filecoinSessionPrivateKey(master);
	}
	// Diagnosis only: a test may pass a public key, which the confidential init
	// adds to root's authorized_keys (relay-button's confidential-init.sh). The
	// app's UI never sets it, and the image carries no key of its own.
	if (profile.debugAuthorizedKeys) secrets.authorized_keys = String(profile.debugAuthorizedKeys);
	if (profile.restoreEntry && profile.ageIdentity) {
		secrets.restore_ledger_entry = JSON.stringify(profile.restoreEntry);
		secrets.age_identity = profile.ageIdentity;
	}

	onProgress({ step: 'unlock', detail: 'VM prüfen (AMD) und entsperren' });
	const relays = await attestRelaysFor(profile);
	const unlock = () =>
		unlockInstance({
			wasm,
			relayUrl: relays[0],
			transport: relayTransports(relays),
			crnHash: starting.crnHash,
			instanceItemHash: instanceHash,
			trustedExecution,
			passphrase: profile.luksPassphrase,
			secrets,
			sign: (payload) => app.signMessage({ message: payload }),
			onProgress: ({ detail }) => onProgress({ step: 'unlock', detail })
		});
	// A resumed start may find the VM unlocked already: its status page answers.
	const already = await vmStatus(host).catch(() => null);
	if (already?.phase) {
		onProgress({ step: 'unlock', detail: 'schon entsperrt' });
	} else {
		const unlocked = await unlock();
		// Which secrets the guest's agent says it stored (names only).
		onProgress({ step: 'unlock', detail: 'entsperrt', injected: unlocked?.injected ?? [] });
	}

	// Sometimes the guest's init never sees the passphrase the agent stored and
	// waits for it forever (seen on 2026-10-26/27 while Aleph was slow): the
	// VM then has no status page, no certificate and no SSH. The agent stays
	// reachable, so when the status page has not answered after a while, the
	// app attests and hands the secrets over again. A VM that is already up
	// is not affected by that.
	onProgress({ step: 'ready', detail: 'Paperless startet' });
	const unlockedAt = Date.now();
	// The fixed name exists only once the VM has set its records; asked
	// earlier, a wildcard in the zone answers with another address, and the
	// browser keeps that for minutes (2026-10-31: the first answer after
	// 529 s). The images take longer than this anyway.
	if (profile.dnsToken) await sleep(FIRST_LOOK_FIXED_MS);
	const again = [...UNLOCK_AGAIN_AFTER_MS];
	let ready = null;
	let answered = false;
	while (!ready) {
		if (Date.now() - unlockedAt > READY_TIMEOUT_MS) throw new Error('Paperless: no answer in time');
		const status = await vmStatus(host).catch(() => null);
		if (status?.phase) {
			answered = true;
			onProgress({ step: 'ready', detail: `Paperless startet (${status.phase})`, status });
			// A failed restore is final too: Paperless runs (empty), and says why.
			if (status.phase === 'ready' || (status.phase === 'restore-failed' && status.paperless)) ready = status;
		}
		if (!ready && !answered && again.length && Date.now() - unlockedAt > again[0]) {
			again.shift();
			onProgress({ step: 'ready', detail: 'Noch keine Antwort der VM: Passphrase erneut übergeben' });
			await unlock().catch((e) => onProgress({ step: 'ready', detail: `Erneute Übergabe fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}` }));
		}
		if (!ready) await sleep(10_000);
	}
	// Whether the VM sealed its data area with a key of its own (image paperless-data-disk).
	const dataDisk = ready.dataDisk?.status === 'encrypted' ? 'encrypted' : ready.dataDisk ? 'plain' : 'unknown';
	return { instanceHash, crnHash: starting.crnHash, payer, host, trustedExecution, dataDisk, ...(ready.phase === 'restore-failed' ? { restore: ready.restore } : {}) };
}

/**
 * @param {Uint8Array} master
 * @param {Record<string, any>} profile with `running` from startPaperless
 * @param {(p: { step: string, detail?: string }) => void} onProgress
 */
export async function stopPaperless(master, profile, onProgress) {
	const run = profile.running;
	if (!run?.instanceHash) throw new Error('Es läuft keine VM.');
	const app = privateKeyToAccount(alephPrivateKey(master));

	onProgress({ step: 'stop', detail: 'Stopp anfordern (letzte Sicherung)' });
	const wasm = await loadWasm();
	const { expectedMeasurements, expectedPolicy } = pinsOf(run.trustedExecution);
	// Each relay once, until one carries the attestation.
	const relays = await attestRelaysFor(profile);
	const transports = relayTransports(relays);
	let attested = null;
	for (let i = 0; !attested; i++) {
		try {
			attested = await attestGuest({ wasm, transport: transports(`?crn=${run.crnHash}&vm=${run.instanceHash}`), expectedMeasurements, expectedPolicy });
		} catch (error) {
			if (i + 1 >= relays.length || /rejected|measurement|policy|signature/i.test(String(error))) throw error;
		}
	}
	try {
		await injectSecrets({ wasm, attested, secrets: { stop_request: String(Date.now()) }, sign: (payload) => app.signMessage({ message: payload }) });
	} finally {
		attested.channel.close();
	}
	const status = await until('stop', async () => {
		const s = await vmStatus(run.host);
		// The backup's latest log line, while it runs (status page: backup.log).
		const line = s?.backup?.status === 'running' ? s.backup.log?.at(-1) : null;
		if (line) onProgress({ step: 'stop', detail: line.replace(/^\S+Z /, ''), status: s });
		return s && ['stopped', 'stop-failed'].includes(s.phase) ? s : null;
	}, { tries: 180, delayMs: 10_000 });
	if (status.phase !== 'stopped') {
		const b = status.stop?.backup ?? status.backup;
		throw new BackupFailedError(b?.reason ?? 'ohne Angabe', b?.log ?? []);
	}

	onProgress({ step: 'forget', detail: 'VM löschen' });
	const crnUrl = await crnAddress(run.crnHash).catch(() => null);
	if (crnUrl) await eraseOnNode(app, run.instanceHash, crnUrl);
	// Who paid at the start, also when the profile changed since.
	await forgetInstance(app, run.payer ?? vmPayer(profile, app.address), run.instanceHash);
	return status;
}
