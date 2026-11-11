// The SEV-SNP runtime (firmware, kernel, initrd) a new VM boots, fixed in the
// app. The launch measurements the app pins in the INSTANCE are computed from
// this runtime, so the app decides which one it is: the item hash is a
// constant here, and what Aleph's API answers for it must be the bundle and
// the boot line named below, or nothing starts.
//
// A new runtime gets in here by hand: read its manifest (a STORE message of
// the address that publishes Aleph's runtimes), check what changed in
// aleph-vm at `rev`, and copy the values.
import { fetchInstanceRuntime, trustedExecution } from '@le-space/attest-wasm/runtime';

export const RUNTIME = Object.freeze({
	name: 'snp-1.2',
	// aleph-snp-instance 2.1.2, aleph-vm@80e48a8e
	itemHash: '5cd480a138c5969b18d1f6850a5fe0176e6f22e65a323ad9593e71165fb687bc',
	bundleSha256: '083630b3b5e22a95ab8f48fdf8a67d80d03420a075ccef97a25d73f8a46378bf',
	cmdlineTemplate: 'console=ttyS0 luks=1 owner={owner}',
	members: Object.freeze({ ovmf: 'image/OVMF.fd', kernel: 'image/bzImage', initrd: 'image/initrd' })
});

export class RuntimeMismatchError extends Error {
	/** @param {string} what */
	constructor(what) {
		super(`Die Laufzeit, die Aleph liefert, ist nicht die, die diese App kennt (${what}). Es wurde nichts gestartet.`);
		this.name = 'RuntimeMismatchError';
	}
}

/**
 * Throws unless `manifest` names exactly the pinned bundle, boot line and
 * bundle members. The library has already checked the bundle's bytes against
 * `manifest.bundle.sha256`.
 * @param {any} manifest @param {typeof RUNTIME} [pin]
 */
export function checkManifest(manifest, pin = RUNTIME) {
	if (manifest?.bundle?.sha256 !== pin.bundleSha256) throw new RuntimeMismatchError('anderes Paket');
	if (manifest?.boot?.cmdline_template !== pin.cmdlineTemplate) throw new RuntimeMismatchError('andere Startzeile');
	for (const [role, file] of Object.entries(pin.members)) {
		if (manifest?.bundle?.members?.[role] !== file) throw new RuntimeMismatchError(`andere Datei für ${role}`);
	}
}

/**
 * `environment.trusted_execution` for a new VM of `owner`: the pinned
 * runtime, checked, and its launch measurements computed here.
 * @param {{ wasm: any, owner: string, vcpus: number, fetch?: typeof fetch, load?: typeof fetchInstanceRuntime, pin?: typeof RUNTIME }} a
 */
export async function pinnedTrustedExecution({ wasm, owner, vcpus, fetch, load = fetchInstanceRuntime, pin = RUNTIME }) {
	const runtime = await load({ itemHash: pin.itemHash, fetch });
	checkManifest(runtime.manifest, pin);
	return trustedExecution({ wasm, runtime, owner, vcpus });
}
