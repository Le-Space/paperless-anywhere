// Starting and stopping a confidential Paperless from the browser, as the
// app's own key, on behalf of the paying account: the INSTANCE, the port
// forward and the FORGET carry `address` = payer (who pays, who owns) and are
// signed by the app's key (sender). Aleph accepts that with the payer's
// authorization; the CRN writes the sender into the measured kernel command
// line, so the app's key is also the one that may unlock the VM.
import {
	createInstanceContent,
	createPortForwardAggregateContent,
	createUnsignedAggregateMessage,
	createUnsignedForgetMessage,
	createUnsignedInstanceMessage,
	signAlephMessage,
	fetch2n6WebAccessUrl,
	notifyCrnAllocationWithRetry,
	eraseInstanceOnCrn
} from '@le-space/core';
import { recoverMessageAddress } from 'viem';
import { ALEPH_API, broadcast as broadcastAndWait, CHANNEL, readFetch } from './aleph.js';
import { tr } from './i18n/index.js';

// A confidential instance includes 40 GiB of rootfs; each GiB beyond costs
// about 184 credits/h (Aleph's price estimate, 2026-10-29: 20, 30 and 40 GiB
// all 57,000 credits/h, 80 GiB 64,359). A start with the flat images uses
// about 16 GiB, which leaves room for the documents and a backup's export.
export const PAPERLESS_VM = Object.freeze({ vcpus: 2, memoryMiB: 4096, rootfsSizeMiB: 40 * 1024, dataDiskMiB: 40 * 1024 });

/**
 * An empty disk on the node next to the rootfs, for what the VM writes. The
 * VM seals its data area with a key it makes at boot and keeps in memory only
 * (paperless-data-disk in the image). Without such a disk, the area is a file
 * on the rootfs mapped with dm-linear, which is what the app uses: with two
 * disks, Aleph's measured init sometimes took the wrong one as its root. An
 * ephemeral volume would be limited to 1 GiB, so it would be a persistent one,
 * which lives as long as the VM.
 */
export const DATA_DISK = false;

export const dataDiskVolume = (sizeMiB = PAPERLESS_VM.dataDiskMiB) => ({
	comment: 'paperless-anywhere: sealed data (dm-crypt, key made in the VM)',
	mount: '/srv/sealed-disk',
	persistence: 'host',
	name: 'sealed-data',
	size_mib: sizeMiB
});
const CORECHANNEL = '0xa1B3bb7d2332383D96b7796B908fB7f7F3c2Be10';

export async function sha256Hex(text) {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
	return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Sign `unsigned` (built with the payer as sender, so its content says
 * address = payer) as the app's key. The item hash covers the content only,
 * so changing the sender keeps it valid.
 * @param {import('viem').LocalAccount} app
 */
export async function signAsDelegate(unsigned, app) {
	return signAlephMessage({ ...unsigned, sender: app.address }, (_sender, payload) => app.signMessage({ message: payload }));
}

async function broadcast(message) {
	const { httpStatus, response } = await broadcastAndWait(message);
	if (httpStatus >= 300) throw Object.assign(new Error(`Aleph refused the ${message.type} (${httpStatus}): ${JSON.stringify(response).slice(0, 200)}`), { refused: true });
	return response;
}

/** A node's https address from the corechannel aggregate. */
export async function crnAddress(crnHash) {
	const res = await readFetch(`${ALEPH_API}/api/v0/aggregates/${CORECHANNEL}.json?keys=corechannel`, tr().life.vm.readNodes);
	const node = (await res.json())?.data?.corechannel?.resource_nodes?.find((n) => n.hash === crnHash);
	if (!node?.address?.startsWith('https://')) throw new Error(`node ${crnHash.slice(0, 12)} has no https address`);
	return node.address.replace(/\/+$/, '');
}

/** The payer's Aleph credits. */
export async function credits(payer) {
	const res = await readFetch(`${ALEPH_API}/api/v0/addresses/${payer}/balance`, tr().life.vm.readBalance);
	return Number((await res.json())?.credit_balance ?? 0);
}

/**
 * The INSTANCE for a confidential Paperless: address = payer, sender = app.
 * @param {{ app: import('viem').LocalAccount, payer: string, rootfsItemHash: string, crnHash: string, trustedExecution: any, name: string }} a
 */
export async function instanceMessage(a) {
	const content = createInstanceContent({
		address: a.payer,
		name: a.name,
		// An encrypted rootfs ignores it; the INSTANCE format wants one key.
		sshPublicKey: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIIJpcGVycGxlc3MtYW55d2hlcmUtbm8tc3NoLWtleQ paperless-anywhere',
		rootfsItemHash: a.rootfsItemHash,
		rootfsSizeMiB: PAPERLESS_VM.rootfsSizeMiB,
		vcpus: PAPERLESS_VM.vcpus,
		memoryMiB: PAPERLESS_VM.memoryMiB,
		crnHash: a.crnHash,
		trustedExecution: a.trustedExecution
	});
	// Off (DATA_DISK, see there): the data area is a file on the image's disk.
	if (DATA_DISK) content.volumes = [dataDiskVolume()];
	const unsigned = await createUnsignedInstanceMessage({ sender: a.payer, content, hasher: sha256Hex, channel: CHANNEL });
	return signAsDelegate(unsigned, a.app);
}

/**
 * Credits per hour Aleph will charge for this INSTANCE, from its own price
 * estimate (no signature needed). Null when Aleph cannot be asked.
 */
export async function estimateCreditsPerHour(message) {
	const { signature: _, ...unsigned } = message;
	// A read, though a POST: asking the second host when api2 fails is safe.
	const res = await readFetch(`${ALEPH_API}/api/v0/price/estimate`, 'estimate', { tries: 1, method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: unsigned }) }).catch(() => null);
	if (!res?.ok) return null;
	const perSecond = Number((await res.json().catch(() => null))?.cost);
	return perSecond > 0 ? Math.round(perSecond * 3600) : null;
}

/** Send the INSTANCE; returns its item hash. */
export async function sendInstance(message) {
	await broadcast(message);
	return message.item_hash;
}

/** Map 443 (Caddy) for the instance, in the payer's port-forwarding aggregate, signed by the app. */
export async function forward443(app, payer, instanceItemHash) {
	const content = createPortForwardAggregateContent({ sender: payer, instanceItemHash, requestedPorts: [{ port: 443, tcp: true, udp: false }] });
	const unsigned = await createUnsignedAggregateMessage({ sender: payer, content, hasher: sha256Hex, channel: CHANNEL });
	return broadcast(await signAsDelegate(unsigned, app));
}

/** Ask the node to allocate the instance now. */
export async function notifyNode(crnUrl, itemHash) {
	const result = await notifyCrnAllocationWithRetry({ crnUrl, itemHash, fetch: (u, i) => fetch(u, i) });
	if (result.status === 'unconfirmed') throw new Error(`the node did not take the instance: ${result.reason ?? 'no reason given'}`);
	return result;
}

/**
 * How long one read from a node, from 2n6 or from a VM's status page may take:
 * a connection that never answers would otherwise hold a start without end
 * (2026-11-17: a resumed start sat at "Port 443" for over 20 minutes).
 */
export const READ_MS = 20_000;
const inTime = () => ({ cache: /** @type {RequestCache} */ ('no-store'), signal: AbortSignal.timeout(READ_MS) });

/**
 * The instance's mapped 443, once the node has applied the forward; null
 * while it has none. Throws when the node does not answer, so a node that
 * cannot be read is never taken for one without the mapping.
 */
export async function mapped443(crnUrl, itemHash) {
	const res = await fetch(`${crnUrl}/v2/about/executions/list`, inTime());
	if (!res.ok) throw new Error(`the node's list of executions: ${res.status}`);
	return (await res.json())?.[itemHash]?.networking?.mapped_ports?.['443']?.host ?? null;
}

/**
 * Whether the node lists the instance among its executions, as running.
 * False when it does not; throws when the node cannot be read.
 */
export async function runsOnNode(crnUrl, itemHash) {
	const res = await fetch(`${crnUrl}/v2/about/executions/list`, inTime());
	if (!res.ok) throw new Error(`the node's list of executions: ${res.status}`);
	const entry = (await res.json())?.[itemHash];
	return entry?.running === true && !entry.status?.stopped_at;
}

/**
 * Where the VM's 443 is reached from IPv4: the node's address and the port it
 * maps to 443. Null until the node lists both.
 * @returns {Promise<{ ipv4: string, port: number } | null>}
 */
export async function publicAddress(crnUrl, itemHash) {
	const res = await fetch(`${crnUrl}/v2/about/executions/list`, inTime());
	if (!res.ok) return null;
	const net = (await res.json())?.[itemHash]?.networking;
	const ipv4 = net?.host_ipv4;
	const port = Number(net?.mapped_ports?.['443']?.host);
	return typeof ipv4 === 'string' && /^\d{1,3}(\.\d{1,3}){3}$/.test(ipv4) && port > 0 && port < 65536 ? { ipv4, port } : null;
}

/**
 * The fixed address (#26): a name under this domain, the same at every start,
 * which the VM points at itself (AAAA: its IPv6; A: the node's IPv4) with the
 * DNS token from the profile, and for which it gets the certificate over DNS.
 */
export const FIXED_HOST_DOMAIN = 'vm.le-space.de';

// One DNS label: letters, digits and inner hyphens, at most 63 characters.
const LABEL = '[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?';
const TWO_N6 = new RegExp(`^${LABEL}\\.2n6\\.me$`);
const DNS_NAME = new RegExp(`^(?:${LABEL}\\.)+[a-z][a-z0-9-]{0,61}[a-z0-9]$`);

/**
 * Whether `host` is a plain DNS name, with a port at most (the fixed address
 * is reached at the node's mapped port): no path, user or IP literal.
 * @param {unknown} host
 */
export function validHost(host) {
	if (typeof host !== 'string') return false;
	const [, name, port] = /^([^:]*)(?::(\d{1,5}))?$/.exec(host) ?? [];
	return Boolean(name) && name.length <= 253 && DNS_NAME.test(name) && (port === undefined || (Number(port) > 0 && Number(port) < 65536));
}

/**
 * The 2n6 name in what 2n6's API answers: one label under 2n6.me, or null
 * for anything else.
 * @param {unknown} raw a bare label, a host or an https URL
 */
export function twoN6Host(raw) {
	const host = String(raw ?? '').trim().toLowerCase().replace(/^https:\/\//, '').replace(/\/$/, '');
	const name = host.includes('.') ? host : `${host}.2n6.me`;
	return TWO_N6.test(name) ? name : null;
}

/** The instance's 2n6 hostname, once 2n6 knows it. */
export async function hostname(itemHash) {
	const access = await fetch2n6WebAccessUrl(itemHash, { fetch: (u, i) => fetch(u, { ...i, signal: AbortSignal.timeout(READ_MS) }) }).catch(() => null);
	return twoN6Host(access?.subdomain ?? access?.url ?? '');
}

/**
 * The VM's status, or null while it does not answer. With the vault's status
 * token, the detailed page at its secret path (restore, backups, stop, disks);
 * images before it publish everything at the public page, which is then used.
 * @param {string} host @param {string} [token] statusToken(master)
 */
export async function vmStatus(host, token) {
	// Nothing, the token least of all, goes to a host that is not a plain DNS name.
	if (!validHost(host)) throw new Error(`not a host name: ${String(host).slice(0, 80)}`);
	if (token) {
		const res = await fetch(`https://${host}/anywhere/s/${token}.json`, inTime()).catch(() => null);
		if (res?.ok) return res.json();
	}
	const res = await fetch(`https://${host}/anywhere/status.json`, inTime()).catch(() => null);
	return res?.ok ? res.json() : null;
}

/** FORGET the instance on behalf of the payer (the node then stops it). */
export async function forgetInstance(app, payer, itemHash, reason = 'paperless-anywhere stop') {
	const signed = await signedForget(app, payer, itemHash, reason);
	// The FORGET's own hash, for its link under "Nachweis".
	return { ...(await broadcast(signed)), itemHash: String(signed.item_hash) };
}

/** The reason of the FORGET a VM sends for itself after its own stop (docs/auto-stop.md). */
export const SELF_FORGET_REASON = 'paperless-anywhere: stopped itself after a backup';

/**
 * A FORGET of the INSTANCE `itemHash`, signed by the app key on behalf of
 * `payer`, not sent. The VM gets it at the start (auto_stop.forget) and sends
 * it itself after a stop of its own with a complete backup; Aleph checks the
 * delegation when it processes it, and an older `time` is accepted.
 * @param {import('viem').LocalAccount} app @param {string} payer @param {string} itemHash @param {string} [reason]
 */
export async function signedForget(app, payer, itemHash, reason = SELF_FORGET_REASON) {
	const unsigned = await createUnsignedForgetMessage({ sender: payer, hashes: [itemHash], reason, hasher: sha256Hex, channel: CHANNEL });
	return signAsDelegate(unsigned, app);
}

/**
 * Whether the INSTANCE `itemHash` was forgotten by the FORGET its VM sent
 * for itself: Aleph says "forgotten", by a FORGET this app key signed with
 * SELF_FORGET_REASON. Null when Aleph cannot be asked; false otherwise.
 * @param {string} appAddress @param {string} itemHash @param {{ get?: (url: string) => Promise<Response | null> }} [deps]
 * @returns {Promise<{ forget: string, at: string | null } | false | null>}
 */
export async function selfForgotten(appAddress, itemHash, { get = (url) => fetch(url, { cache: 'no-store' }).catch(() => null) } = {}) {
	const res = await get(`${ALEPH_API}/api/v0/messages/${itemHash}`);
	if (!res?.ok) return null;
	const answer = await res.json().catch(() => null);
	if (answer?.status !== 'forgotten') return false;
	const by = [...(answer.forgotten_by ?? []), ...(answer.message?.forgotten_by ?? [])].filter((h) => typeof h === 'string' && /^[0-9a-f]{64}$/.test(h));
	for (const hash of by) {
		const r = await get(`${ALEPH_API}/api/v0/messages/${hash}`);
		const f = r?.ok ? await r.json().catch(() => null) : null;
		const m = f?.message ?? f;
		const content = typeof m?.content === 'object' && m.content ? m.content : (() => { try { return JSON.parse(m?.item_content ?? 'null'); } catch { return null; } })();
		if (String(m?.sender ?? '').toLowerCase() === appAddress.toLowerCase() && content?.reason === SELF_FORGET_REASON && (content?.hashes ?? []).includes(itemHash)) {
			const t = Number(m?.time ?? content?.time);
			return { forget: hash, at: f?.reception_time ?? (Number.isFinite(t) ? new Date(t * 1000).toISOString() : null) };
		}
	}
	return false;
}

/**
 * This app's Paperless VMs: INSTANCE messages its key sent, named paperless-*,
 * newest first, each with who pays it; only those of `payer` when given. A
 * start that was interrupted leaves one that no profile knows about; this
 * finds it too.
 * @param {string} appAddress @param {string} [payer]
 */
export async function listVms(appAddress, payer) {
	const url = new URL('/api/v0/messages.json', ALEPH_API);
	url.searchParams.set('msgTypes', 'INSTANCE');
	// `addresses` matches the sender only, never the address a delegate acts
	// for: ask for the app's own messages, then keep those for this payer.
	url.searchParams.set('addresses', appAddress);
	url.searchParams.set('message_statuses', 'processed,pending');
	url.searchParams.set('pagination', '50');
	const res = await readFetch(String(url), tr().life.vm.readList);
	if (!res.ok) throw new Error(tr().life.vm.listUnreadable(res.status));
	return ownVms((await res.json()).messages ?? [], appAddress, payer);
}

/**
 * The INSTANCE `itemHash` as this app key signed it, checked here (content
 * hash and signature), so a stop after adopting it pins the measurements this
 * app put in, not whatever an API answer says.
 * @param {string} appAddress @param {string} itemHash
 */
export async function ownInstance(appAddress, itemHash) {
	const res = await readFetch(`${ALEPH_API}/api/v0/messages/${itemHash}`, tr().life.vm.lookUp);
	if (!res.ok) throw new Error(tr().life.vm.vmUnreadable(itemHash.slice(0, 12), res.status));
	return checkOwnInstance(appAddress, itemHash, (await res.json())?.message);
}

/** @param {string} appAddress @param {string} itemHash @param {any} m the message as Aleph returns it */
export async function checkOwnInstance(appAddress, itemHash, m) {
	if (m?.type !== 'INSTANCE' || m.item_hash !== itemHash || typeof m.item_content !== 'string') throw new Error(tr().life.vm.noInstance);
	if ((await sha256Hex(m.item_content)) !== itemHash) throw new Error(tr().life.vm.contentMismatch);
	const signer = await recoverMessageAddress({ message: [m.chain, m.sender, m.type, m.item_hash].join('\n'), signature: m.signature });
	if (signer.toLowerCase() !== appAddress.toLowerCase()) throw new Error(tr().life.vm.notOurs);
	return JSON.parse(m.item_content);
}

/** @param {any[]} messages @param {string} appAddress @param {string} [payer] */
export function ownVms(messages, appAddress, payer) {
	const same = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();
	return messages
		.filter((m) => same(m.sender, appAddress) && (!payer || same(m.content?.address, payer)) && String(m.content?.metadata?.name ?? '').startsWith('paperless-'))
		.map((m) => ({
			itemHash: String(m.item_hash),
			name: String(m.content.metadata.name),
			createdAt: Math.round(Number(m.time) * 1000),
			crnHash: m.content?.requirements?.node?.node_hash ?? null,
			payer: String(m.content?.address ?? '')
		}))
		.sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Ask the node to stop and erase the VM now. A FORGET alone works too, but the
 * node notices it only minutes later (measured: about 4) and keeps the VM
 * running and its address answering meanwhile. Best effort: the FORGET stays.
 */
export async function eraseOnNode(app, itemHash, crnUrl) {
	return eraseInstanceOnCrn({
		sender: app.address,
		signer: (_sender, payload) => app.signMessage({ message: payload }),
		instanceHash: itemHash,
		crnUrl,
		fetch: (u, i) => fetch(u, i)
	}).catch((e) => ({ ok: false, error: e instanceof Error ? e.message : String(e) }));
}

/** The VM's state on its node (running, stopping, …), or null when the node does not list it. */
export async function nodeState(crnUrl, itemHash) {
	const res = await fetch(`${crnUrl}/v2/about/executions/list`, { cache: 'no-store' }).catch(() => null);
	if (!res?.ok) return null;
	return (await res.json().catch(() => ({})))?.[itemHash]?.state ?? null;
}
