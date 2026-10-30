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
import { ALEPH_API, broadcast as broadcastAndWait, CHANNEL } from './aleph.js';

// A confidential instance includes 40 GiB of rootfs; each GiB beyond costs
// about 184 credits/h (Aleph's price estimate, 2026-10-29: 20, 30 and 40 GiB
// all 57,000 credits/h, 80 GiB 64,359). A start with the flat images uses
// about 16 GiB, which leaves room for the documents and a backup's export.
export const PAPERLESS_VM = Object.freeze({ vcpus: 2, memoryMiB: 4096, rootfsSizeMiB: 40 * 1024, dataDiskMiB: 40 * 1024 });

/**
 * An empty disk on the node next to the rootfs, for what the VM writes. The
 * VM seals it with a key it makes at boot and keeps in memory only
 * (paperless-data-disk in the image); the guest kernel has no loop driver, so
 * a file on the shared-key rootfs cannot serve. An ephemeral volume would be
 * limited to 1 GiB, so it is a persistent one, which lives as long as the VM.
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
	if (httpStatus >= 300) throw new Error(`Aleph refused the ${message.type} (${httpStatus}): ${JSON.stringify(response).slice(0, 200)}`);
	return response;
}

/** A node's https address from the corechannel aggregate. */
export async function crnAddress(crnHash) {
	const res = await fetch(`${ALEPH_API}/api/v0/aggregates/${CORECHANNEL}.json?keys=corechannel`);
	const node = (await res.json())?.data?.corechannel?.resource_nodes?.find((n) => n.hash === crnHash);
	if (!node?.address?.startsWith('https://')) throw new Error(`node ${crnHash.slice(0, 12)} has no https address`);
	return node.address.replace(/\/+$/, '');
}

/** The payer's Aleph credits. */
export async function credits(payer) {
	const res = await fetch(`${ALEPH_API}/api/v0/addresses/${payer}/balance`, { cache: 'no-store' });
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
	// Off for now: with Docker's vfs driver the images alone take about 36 GiB
	// of the 40 GiB disk (measured 2026-10-25), too little for a restore and an
	// export. Back on once the images are flattened (one layer each).
	if (DATA_DISK) content.volumes = [dataDiskVolume()];
	const unsigned = await createUnsignedInstanceMessage({ sender: a.payer, content, hasher: sha256Hex, channel: CHANNEL });
	return signAsDelegate(unsigned, a.app);
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

/** The instance's mapped 443, once the node has applied the forward. */
export async function mapped443(crnUrl, itemHash) {
	const res = await fetch(`${crnUrl}/v2/about/executions/list`, { cache: 'no-store' });
	if (!res.ok) return null;
	return (await res.json())?.[itemHash]?.networking?.mapped_ports?.['443']?.host ?? null;
}

/** The instance's 2n6 hostname, once 2n6 knows it. */
export async function hostname(itemHash) {
	const access = await fetch2n6WebAccessUrl(itemHash, { fetch: (u, i) => fetch(u, i) }).catch(() => null);
	const raw = access?.subdomain ?? access?.url ?? '';
	const host = String(raw).replace(/^https?:\/\//, '').replace(/\/.*$/, '');
	return host ? (host.includes('.') ? host : `${host}.2n6.me`) : null;
}

/** The VM's status page, or null while it does not answer. */
export async function vmStatus(host) {
	const res = await fetch(`https://${host}/anywhere/status.json`, { cache: 'no-store' }).catch(() => null);
	return res?.ok ? res.json() : null;
}

/** FORGET the instance on behalf of the payer (the node then stops it). */
export async function forgetInstance(app, payer, itemHash, reason = 'paperless-anywhere stop') {
	const unsigned = await createUnsignedForgetMessage({ sender: payer, hashes: [itemHash], reason, hasher: sha256Hex, channel: CHANNEL });
	return broadcast(await signAsDelegate(unsigned, app));
}

/**
 * This app's Paperless VMs: INSTANCE messages its key sent on behalf of the
 * payer and named paperless-*, newest first. A start that was interrupted
 * leaves one that no profile knows about; this finds it too.
 * @param {string} appAddress @param {string} payer
 */
export async function listVms(appAddress, payer) {
	const url = new URL('/api/v0/messages.json', ALEPH_API);
	url.searchParams.set('msgTypes', 'INSTANCE');
	// `addresses` matches the sender only, never the address a delegate acts
	// for: ask for the app's own messages, then keep those for this payer.
	url.searchParams.set('addresses', appAddress);
	url.searchParams.set('message_statuses', 'processed,pending');
	url.searchParams.set('pagination', '50');
	const res = await fetch(url, { cache: 'no-store' });
	if (!res.ok) throw new Error(`Aleph: VM-Liste nicht lesbar (${res.status})`);
	return ownVms((await res.json()).messages ?? [], appAddress, payer);
}

/** @param {any[]} messages @param {string} appAddress @param {string} [payer] */
/**
 * The INSTANCE `itemHash` as this app key signed it, checked here (content
 * hash and signature), so a stop after adopting it pins the measurements this
 * app put in, not whatever an API answer says.
 * @param {string} appAddress @param {string} itemHash
 */
export async function ownInstance(appAddress, itemHash) {
	const res = await fetch(`${ALEPH_API}/api/v0/messages/${itemHash}`, { cache: 'no-store' });
	if (!res.ok) throw new Error(`Aleph: VM ${itemHash.slice(0, 12)} nicht lesbar (${res.status})`);
	return checkOwnInstance(appAddress, itemHash, (await res.json())?.message);
}

/** @param {string} appAddress @param {string} itemHash @param {any} m the message as Aleph returns it */
export async function checkOwnInstance(appAddress, itemHash, m) {
	if (m?.type !== 'INSTANCE' || m.item_hash !== itemHash || typeof m.item_content !== 'string') throw new Error('Keine INSTANCE mit diesem Hash.');
	if ((await sha256Hex(m.item_content)) !== itemHash) throw new Error('Der Inhalt der INSTANCE passt nicht zu ihrem Hash.');
	const signer = await recoverMessageAddress({ message: [m.chain, m.sender, m.type, m.item_hash].join('\n'), signature: m.signature });
	if (signer.toLowerCase() !== appAddress.toLowerCase()) throw new Error('Diese VM hat nicht der Schlüssel dieser App gestartet.');
	return JSON.parse(m.item_content);
}

export function ownVms(messages, appAddress, payer) {
	const same = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();
	return messages
		.filter((m) => same(m.sender, appAddress) && (!payer || same(m.content?.address, payer)) && String(m.content?.metadata?.name ?? '').startsWith('paperless-'))
		.map((m) => ({
			itemHash: String(m.item_hash),
			name: String(m.content.metadata.name),
			createdAt: Math.round(Number(m.time) * 1000),
			crnHash: m.content?.requirements?.node?.node_hash ?? null
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
