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
import { attestGuest, injectSecrets, websocketTransport } from '@le-space/attest-wasm/ratls';
import { alephPrivateKey, filecoinSessionPrivateKey, paperlessSecrets } from './keys/derive.js';
import { crnAddress, credits, forgetInstance, forward443, hostname, instanceMessage, mapped443, notifyNode, PAPERLESS_VM, sendInstance, vmStatus, eraseOnNode } from './vm.js';

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
	if (!profile.payer) missing.push('zahlendes Konto');
	if (!profile.attestRelay) missing.push('Attest-Relay');
	if (!profile.rootfsItemHash) missing.push('Paperless-Image');
	if (!profile.luksPassphrase) missing.push('Image-Passphrase');
	if (!profile.crnHash) missing.push('Knoten');
	return missing;
}

/**
 * @param {Uint8Array} master
 * @param {Record<string, any>} profile
 * @param {(p: { step: string, detail?: string }) => void} onProgress
 * @returns {Promise<{ instanceHash: string, crnHash: string, host: string, trustedExecution: any }>}
 */
export async function startPaperless(master, profile, onProgress) {
	const missing = startRequirements(profile);
	if (missing.length) throw new Error(`Für den Start fehlt: ${missing.join(', ')}`);
	const app = privateKeyToAccount(alephPrivateKey(master));
	const balance = await credits(profile.payer);
	// About four hours of a 2-vCPU confidential instance plus margin; refuses an empty account early.
	if (balance < (profile.minCredits ?? 50_000)) throw new Error(`Zu wenig Credits auf dem zahlenden Konto (${balance}).`);

	onProgress({ step: 'measure', detail: 'Messwerte für diesen Start berechnen' });
	const wasm = await loadWasm();
	const trustedExecution = await confidentialTrustedExecution({ wasm, owner: app.address, vcpus: PAPERLESS_VM.vcpus });

	onProgress({ step: 'instance', detail: 'VM anfordern' });
	const message = await instanceMessage({ app, payer: profile.payer, rootfsItemHash: profile.rootfsItemHash, crnHash: profile.crnHash, trustedExecution, name: `paperless-${new Date().toISOString().slice(0, 16)}` });
	const instanceHash = await sendInstance(message);
	const crnUrl = await crnAddress(profile.crnHash);
	await notifyNode(crnUrl, instanceHash);

	onProgress({ step: 'network', detail: 'Port 443 und Adresse' });
	await forward443(app, profile.payer, instanceHash);
	await until('port 443', () => mapped443(crnUrl, instanceHash), { tries: 60 });
	// The node restarts the VM to apply a mapping; give it a moment before the unlock.
	await sleep(15_000);
	const host = await until('hostname', () => hostname(instanceHash), { tries: 30, delayMs: 10_000 });

	const p = paperlessSecrets(master);
	const secrets = {
		https_hostname: host,
		paperless_role: profile.role === 'primary' ? 'primary' : 'test',
		paperless_admin_password: p.adminPassword,
		paperless_db_password: p.dbPassword,
		paperless_secret_key: p.secretKey
	};
	if (profile.backupConfig) {
		secrets.backup_config = JSON.stringify({ ...profile.backupConfig, payer: profile.payer, network: profile.network === 'mainnet' ? 'mainnet' : 'calibration' });
		secrets.backup_session_key = filecoinSessionPrivateKey(master);
	}
	if (profile.restoreEntry && profile.ageIdentity) {
		secrets.restore_ledger_entry = JSON.stringify(profile.restoreEntry);
		secrets.age_identity = profile.ageIdentity;
	}

	onProgress({ step: 'unlock', detail: 'VM prüfen (AMD) und entsperren' });
	await unlockInstance({
		wasm,
		relayUrl: profile.attestRelay,
		crnHash: profile.crnHash,
		instanceItemHash: instanceHash,
		trustedExecution,
		passphrase: profile.luksPassphrase,
		secrets,
		sign: (payload) => app.signMessage({ message: payload }),
		onProgress: ({ detail }) => onProgress({ step: 'unlock', detail })
	});

	onProgress({ step: 'ready', detail: 'Paperless startet' });
	const ready = await until('Paperless', async () => {
		const status = await vmStatus(host);
		if (status?.phase) onProgress({ step: 'ready', detail: `Paperless startet (${status.phase})`, status });
		// A failed restore is final too: Paperless runs (empty), and says why.
		return status?.phase === 'ready' || (status?.phase === 'restore-failed' && status.paperless) ? status : null;
	}, { tries: 120, delayMs: 10_000 });
	return { instanceHash, crnHash: profile.crnHash, host, trustedExecution, ...(ready.phase === 'restore-failed' ? { restore: ready.restore } : {}) };
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
	const url = `${profile.attestRelay}?crn=${run.crnHash}&vm=${run.instanceHash}`;
	const attested = await attestGuest({ wasm, transport: websocketTransport(url), expectedMeasurements, expectedPolicy });
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
	await forgetInstance(app, profile.payer, run.instanceHash);
	return status;
}
