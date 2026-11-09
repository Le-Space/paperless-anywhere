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
import { alephPrivateKey, backupPrivateKey, filecoinSessionPrivateKey, fixedHostLabel, paperlessSecrets, statusToken } from './keys/derive.js';
import { backupAuthorize, backupKeyAddress, backupRevoke, creditsAccount, CREDITS_PRODUCT, CREDITS_URL } from './credits.js';
import { confidentialCreditsPerHour, RESERVE_HOURS, runningCreditsPerHour } from './balances.js';
import { relayTransports } from './attest-p2p.js';
import { backupFacts, vmBackupSecrets } from './backups.js';
import { attestRelaysFor } from './relays.js';
import { updateProfile, vmPayer } from './profile.js';
import { ALEPH_API, readFetch } from './aleph.js';
import { crnAddress, credits, estimateCreditsPerHour, FIXED_HOST_DOMAIN, forgetInstance, forward443, hostname, instanceMessage, mapped443, notifyNode, PAPERLESS_VM, publicAddress, sendInstance, vmStatus, eraseOnNode } from './vm.js';

/** Aleph would refuse the start: the payer holds less than a day of reserve. */
export class AlephShortError extends Error {
	/** @param {string} message @param {{ balance: number, reserve: number, vmPerHour: number }} amounts */
	constructor(message, { balance, reserve, vmPerHour }) {
		super(message);
		this.name = 'AlephShortError';
		this.balance = balance;
		this.reserve = reserve;
		this.vmPerHour = vmPerHour;
	}
}

/** The last backup failed; the VM stays. Carries the VM's reason, what it saw (memory, space, exit code) and its tool's last log lines. */
export class BackupFailedError extends Error {
	/** @param {string} reason @param {string[]} log @param {string[]} [facts] */
	constructor(reason, log, facts = []) {
		super(`Die letzte Sicherung ist fehlgeschlagen; die VM bleibt. Grund: ${reason}`);
		this.name = 'BackupFailedError';
		this.reason = reason;
		this.log = log;
		this.facts = facts;
	}
}

/**
 * A stop whose backup reached fewer providers than requested (one refused the
 * piece; the others hold their copies). Paperless is paused and the VM waits
 * for the person: erase it anyway (eraseStopped) or keep it (resumeAfterPartial).
 */
export class BackupPartialError extends Error {
	/** @param {any} status the VM's status page in phase "stop-partial" */
	constructor(status) {
		const b = status?.stop?.backup ?? status?.backup;
		const have = b?.backup?.copies?.length ?? 0;
		const want = b?.backup?.requestedCopies ?? have;
		super(`Gesichert, aber nur ${have} von ${want} Kopien sind angekommen: ein Anbieter hat die Sicherung abgelehnt. Paperless ist angehalten.`);
		this.name = 'BackupPartialError';
		this.status = status;
		this.copies = have;
		this.requested = want;
		this.log = b?.log ?? [];
		this.facts = [];
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

/**
 * With backups paid through Le Space Credits: authorize the VM's backup key
 * again and keep the service's answer (payer, signer, tag, label, network)
 * in the profile when it changed. Without an answer, the recorded one.
 * @param {Uint8Array} master @param {Record<string, any>} profile
 * @param {{ authorize?: (master: Uint8Array) => Promise<{ payer: string, signer: string, tag: string, label: string, network: string }>, update?: typeof updateProfile }} [deps]
 */
export async function refreshBackupSigner(master, profile, { authorize = (m) => backupAuthorize(m, backupKeyAddress(m)), update = updateProfile } = {}) {
	if (!profile.backupsByCredits) return null;
	let s;
	try {
		s = await authorize(master);
	} catch {
		return profile.backupSigner ?? null;
	}
	const fresh = { payer: s.payer, signer: s.signer, tag: s.tag, label: s.label, network: s.network };
	const old = profile.backupSigner;
	// Authorized again: a revoke still pending from a deleted VM is moot.
	if (!old || profile.backupRevokePending || Object.keys(fresh).some((k) => old[k] !== fresh[k]))
		await update(master, ({ backupRevokePending, ...p }) => ({ ...p, backupSigner: fresh })).catch(() => {});
	return fresh;
}

/**
 * Whether the backup key may be revoked once the VM `deletedHash` is gone:
 * only with backups paid through Le Space Credits, and only when no other VM
 * of this vault still uses the key. Production and trial share it (slot 0),
 * so a running, starting or trial VM other than the deleted one keeps it.
 * A trial's end never calls this.
 * @param {Record<string, any>} profile @param {string | null} deletedHash
 */
export function shouldRevokeBackupKey(profile, deletedHash) {
	if (!profile?.backupsByCredits) return false;
	return ![profile.running, profile.starting, profile.trial].some((vm) => vm && vm.instanceHash !== deletedHash);
}

/**
 * Revoke the VM's backup key after the production VM `deletedHash` is
 * deleted, when no other VM uses it. A failure never blocks the deletion:
 * it is said in the progress line and kept as `backupRevokePending` in the
 * sealed profile, for the start screen to try again.
 * @param {Uint8Array} master @param {Record<string, any>} profile @param {string | null} deletedHash
 * @param {{ revoke?: (master: Uint8Array) => Promise<{ revoked: boolean }>, update?: typeof updateProfile, onProgress?: (p: { step: string, detail?: string }) => void }} [deps]
 * @returns {Promise<'skipped' | 'revoked' | 'pending'>}
 */
export async function revokeBackupKey(master, profile, deletedHash, { revoke = (m) => backupRevoke(m, backupKeyAddress(m)), update = updateProfile, onProgress = () => {} } = {}) {
	if (!shouldRevokeBackupKey(profile, deletedHash)) return 'skipped';
	try {
		await revoke(master);
	} catch (e) {
		onProgress({ step: 'forget', detail: `VM gelöscht; den Schlüssel der VM für die Sicherungen nimmt die App beim nächsten Öffnen zurück (${e instanceof Error ? e.message : String(e)})` });
		await update(master, (p) => ({ ...p, backupRevokePending: true })).catch(() => {});
		return 'pending';
	}
	if (profile.backupRevokePending) await update(master, ({ backupRevokePending, ...p }) => p).catch(() => {});
	return 'revoked';
}

/**
 * On the start screen: try a revoke that failed when the VM was deleted, as
 * long as no VM of this vault uses the key again.
 * @param {Uint8Array} master @param {Record<string, any>} profile
 * @param {Parameters<typeof revokeBackupKey>[3]} [deps]
 */
export async function retryBackupRevoke(master, profile, deps) {
	if (!profile?.backupRevokePending) return null;
	return revokeBackupKey(master, profile, null, deps);
}

/** What a start needs from the profile; throws with a reason a person can act on. */
export function startRequirements(profile) {
	const missing = [];
	// The wallet pays the VM, or only the backups when the app pays (appPays).
	if (!profile.payer && !profile.appPays && !profile.leSpacePays) missing.push('zahlendes Konto');
	// Backups paid through Le Space Credits need no wallet: Le Space's payer
	// pays them, once the service has the VM's backup key.
	if (!profile.payer && profile.backupConfig && !profile.backupsByCredits) missing.push('Wallet für die Sicherungen');
	const signerNetwork = profile.network === 'mainnet' ? 'mainnet' : 'calibration';
	if (profile.backupConfig && profile.backupsByCredits && (!profile.backupSigner?.payer || profile.backupSigner.network !== signerNetwork)) missing.push('Sicherungen über Le Space Credits freigeben');
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
	if (!payer) throw new Error('Es ist noch kein Konto bekannt, das die VM bezahlt.');
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
		throw new AlephShortError(
			`Für einen Start fehlen noch ${(reserve - balance).toLocaleString('de-DE')} Aleph-Credits auf ${profile.leSpacePays ? 'dem Konto, mit dem Le Space deine VM bezahlt' : profile.appPays ? 'dem Konto der App' : 'dem zahlenden Konto'}. Aleph nimmt die VM erst mit einem Tag Reserve an: ${reserve.toLocaleString('de-DE')} (${vmPerHour.toLocaleString('de-DE')} Credits/h für Paperless${running}), da sind ${balance.toLocaleString('de-DE')}.`,
			{ balance, reserve, vmPerHour }
		);
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
		paperless_secret_key: p.secretKey,
		status_token: statusToken(master)
	};
	if (profile.backupConfig) {
		// Through Le Space Credits: ask the service again (it may have a new
		// payer or signer, which the profile then keeps); without an answer,
		// what the setup recorded.
		const signer = await refreshBackupSigner(master, profile);
		try {
			Object.assign(
				secrets,
				vmBackupSecrets(profile, {
					...(profile.backupsByCredits
						? { backupKey: backupPrivateKey(master), signer, creditsUrl: CREDITS_URL, product: CREDITS_PRODUCT, account: creditsAccount(master).address }
						: { sessionKey: filecoinSessionPrivateKey(master) })
				})
			);
		} catch (e) {
			// Paperless starts anyway; the VM reports "no backup_config".
			onProgress({ step: 'unlock', detail: `Ohne Sicherungen: ${e instanceof Error ? e.message : String(e)}` });
		}
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
	const already = await vmStatus(host, statusToken(master)).catch(() => null);
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
		const status = await vmStatus(host, statusToken(master)).catch(() => null);
		if (status?.phase) {
			answered = true;
			onProgress({ step: 'ready', detail: `Paperless startet (${status.phase})`, status });
			// A failed restore is final too: Paperless runs (empty), and says why.
			if (status.phase === 'ready' || (status.phase === 'restore-failed' && status.paperless)) ready = status;
			// The image refuses to run Paperless without its sealed data area.
			if (status.phase === 'data-disk-failed') throw new Error(`Die VM konnte ihre verschlüsselte Datenplatte nicht anlegen (${status.dataDisk?.reason ?? 'ohne Angabe'}); Paperless startet darauf nicht. Die VM unter „Meine VMs“ löschen und neu starten.`);
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
 * A request to the running VM, the way the unlock reaches it: attest the
 * guest against the pins of this start, then hand over `secrets` over the
 * attested channel, signed by the app's key (the guest's agent accepts only
 * the key that started the VM). The guest writes each to /tmp/secrets.
 * @param {Uint8Array} master @param {Record<string, any>} profile with `running` @param {Record<string, string>} secrets
 */
async function sendToGuest(master, profile, secrets) {
	const run = profile.running;
	const app = privateKeyToAccount(alephPrivateKey(master));
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
		await injectSecrets({ wasm, attested, secrets, sign: (payload) => app.signMessage({ message: payload }) });
	} finally {
		attested.channel.close();
	}
}

/**
 * Back up now, while Paperless keeps running (paperless-backup-loop answers
 * backup_request with "paperless-backup run", or "check" when a backup just
 * ran or holds the lock). Follows the VM's status page until the request is
 * done ("partial" when a provider refused the piece; the others hold their
 * copies); throws BackupFailedError when it failed.
 * @param {Uint8Array} master
 * @param {Record<string, any>} profile with `running`
 * @param {(p: { detail: string, status?: any }) => void} onProgress
 * @param {{ send?: typeof sendToGuest, status?: typeof vmStatus, delayMs?: number, tries?: number }} [deps] for the tests
 * @returns {Promise<any>} the status page with the finished request
 */
export async function requestBackup(master, profile, onProgress, { send = sendToGuest, status: read = vmStatus, delayMs = 5000, tries = 360 } = {}) {
	const run = profile.running;
	if (!run?.instanceHash) throw new Error('Es läuft keine VM.');
	const token = statusToken(master);
	const before = await read(run.host, token).catch(() => null);
	// An image without the request would take it and never answer.
	if (before && !('backupSchedule' in before)) throw new Error('Diese VM kennt „Jetzt sichern“ noch nicht (älteres Image).');
	const earlier = before?.backupRequest?.at ?? null;
	await send(master, profile, { backup_request: String(Date.now()) });
	onProgress({ detail: 'requested' });
	const done = await until('backup', async () => {
		const s = await read(run.host, token);
		const req = s?.backupRequest;
		if (!req || req.at === earlier) return null;
		onProgress({ detail: req.status, status: s });
		return ['done', 'partial', 'failed'].includes(req.status) ? s : null;
	}, { tries, delayMs });
	if (!['done', 'partial'].includes(done.backupRequest.status)) {
		const b = done.backupRequest.backup ?? done.backup;
		throw new BackupFailedError(b?.reason ?? ({ interrupted: 'unterbrochen', stopping: 'Paperless wird gerade gesichert und beendet' }[done.backupRequest.mode] ?? 'ohne Angabe'), b?.log ?? [], backupFacts(b));
	}
	return done;
}

/**
 * @param {Uint8Array} master
 * @param {Record<string, any>} profile with `running` from startPaperless
 * @param {(p: { step: string, detail?: string }) => void} onProgress
 */
export async function stopPaperless(master, profile, onProgress, { send = sendToGuest, status: read = vmStatus, delayMs = 10_000, tries = 180, erase = eraseStopped } = {}) {
	const run = profile.running;
	if (!run?.instanceHash) throw new Error('Es läuft keine VM.');
	const token = statusToken(master);

	onProgress({ step: 'stop', detail: 'Stopp anfordern (letzte Sicherung)' });
	// Only the answer to this request counts: the status page may still show an
	// earlier stop's outcome until the VM picks the new one up (within seconds).
	// An image that names no request in stop.json is told apart by the time.
	const earlier = (await read(run.host, token).catch(() => null))?.stop?.at ?? null;
	const request = String(Date.now());
	await send(master, profile, { stop_request: request });
	const status = await until('stop', async () => {
		const s = await read(run.host, token);
		if (!s?.stop) return null;
		if ('request' in s.stop ? s.stop.request !== request : s.stop.at === earlier) return null;
		// The backup's latest log line, while it runs (status page: backup.log).
		const line = s.backup?.status === 'running' ? s.backup.log?.at(-1) : null;
		if (line) onProgress({ step: 'stop', detail: line.replace(/^\S+Z /, ''), status: s });
		return ['stopped', 'stop-failed', 'stop-partial'].includes(s.phase) ? s : null;
	}, { tries, delayMs });
	if (status.phase === 'stop-partial') throw new BackupPartialError(status);
	if (status.phase !== 'stopped') {
		const b = status.stop?.backup ?? status.backup;
		throw new BackupFailedError(b?.reason ?? 'ohne Angabe', b?.log ?? [], backupFacts(b));
	}
	return erase(master, profile, status, onProgress);
}

/**
 * Erase the VM after its last backup: at once after a full one, or when the
 * person chose to after a partial one.
 * @param {Uint8Array} master
 * @param {Record<string, any>} profile with `running`
 * @param {any} status the VM's status page at the end of the stop
 * @param {(p: { step: string, detail?: string }) => void} onProgress
 */
export async function eraseStopped(master, profile, status, onProgress) {
	const run = profile.running;
	const app = privateKeyToAccount(alephPrivateKey(master));
	onProgress({ step: 'forget', detail: 'VM löschen' });
	const crnUrl = await crnAddress(run.crnHash).catch(() => null);
	if (crnUrl) await eraseOnNode(app, run.instanceHash, crnUrl);
	// Who paid at the start, also when the profile changed since.
	await forgetInstance(app, run.payer ?? vmPayer(profile, app.address), run.instanceHash);
	await revokeBackupKey(master, profile, run.instanceHash, { onProgress });
	return status;
}

/**
 * Keep the VM after a partial backup: Paperless starts again (paperless-stop
 * answers stop_resume, naming the partial stop's request, with "resumed"). The two-hourly check then backs up to
 * every provider again.
 * @param {Uint8Array} master
 * @param {Record<string, any>} profile with `running`
 * @param {{ send?: typeof sendToGuest, status?: typeof vmStatus, delayMs?: number, tries?: number }} [deps] for the tests
 */
export async function resumeAfterPartial(master, profile, { send = sendToGuest, status: read = vmStatus, delayMs = 5000, tries = 36 } = {}) {
	const run = profile.running;
	if (!run?.instanceHash) throw new Error('Es läuft keine VM.');
	// The resume names the stop it answers: an old one never restarts
	// Paperless after a later stop.
	const page = await read(run.host, statusToken(master)).catch(() => null);
	const request = page?.stop?.status === 'partial' ? page.stop.request : null;
	if (!request) throw new Error('Die VM wartet auf keine Antwort mehr; bitte die Seite neu laden.');
	await send(master, profile, { stop_resume: String(request) });
	return until('Paperless wieder starten', async () => {
		const s = await read(run.host, statusToken(master));
		return s?.stop?.status === 'resumed' ? s : null;
	}, { tries, delayMs });
}

/**
 * A trial: a second Paperless beside the running one, restored from a backup
 * to check that the backup is whole. It runs as a test (mail rules off), makes
 * no backups of its own and takes no fixed address (that belongs to the
 * production one): the instance's own name. It ends without a backup.
 * @param {Record<string, any>} profile
 * @param {any} entry the restore entry of the backup to try (restoreEntry())
 */
export function trialProfile(profile, entry) {
	const { running, starting, trial, dnsToken, backupConfig, ...rest } = profile;
	return { ...rest, role: 'test', restoreEntry: entry };
}

/**
 * Start a trial (see trialProfile); `onRequested` gets the VM as soon as Aleph
 * has it, so it can be kept in the profile and ended after a reload.
 * @param {Uint8Array} master @param {Record<string, any>} profile @param {any} entry
 * @param {(p: { step: string, detail?: string, instanceHash?: string }) => void} onProgress
 * @param {{ onRequested?: (starting: Starting) => Promise<void> | void }} [options]
 */
export async function startTrial(master, profile, entry, onProgress, options) {
	if (!profile.ageIdentity) throw new Error('Ohne den Schlüssel der Sicherungen lässt sich keine Sicherung prüfen.');
	const run = await startPaperless(master, trialProfile(profile, entry), onProgress, options);
	// How the restore went: the status page's restore.json (documents, seconds).
	const status = await vmStatus(run.host, statusToken(master)).catch(() => null);
	return { ...run, restore: status?.restore ?? run.restore ?? null };
}

/**
 * End a trial: the VM goes without a backup (it never makes one).
 * @param {Uint8Array} master @param {Record<string, any>} trial `profile.trial`
 * @param {Record<string, any>} profile
 */
export async function endTrial(master, trial, profile) {
	if (!trial?.instanceHash) return;
	const app = privateKeyToAccount(alephPrivateKey(master));
	const crnUrl = await crnAddress(trial.crnHash).catch(() => null);
	if (crnUrl) await eraseOnNode(app, trial.instanceHash, crnUrl).catch(() => {});
	await forgetInstance(app, trial.payer ?? vmPayer(profile, app.address), trial.instanceHash);
}
