// The Aleph compute nodes (CRNs) that can run a confidential VM right now, for
// the landing page's live graphic. The corechannel aggregate lists the nodes
// but not what their hardware supports; Aleph's CRN list adds what each node
// reports about itself (confidential_support, free CPU, memory and disk).

export const CRN_LIST = 'https://crns-list.aleph.sh/crns.json?filter_inactive=true';

// The Paperless VM: 2 vCPU, 4 GiB memory, 40 GiB disk.
export const PAPERLESS_VM = Object.freeze({ vcpus: 2, memoryKiB: 4 * 1024 ** 2, diskKiB: 40 * 1024 ** 2 });

/** @typedef {{ hash: string, name: string, score: number, freeVcpus: number, freeMemoryGiB: number, freeDiskGiB: number, fits: boolean }} TeeNode */

/**
 * The confidential-capable nodes of a CRN list, best score first.
 * @param {any} body the CRN list's JSON
 * @returns {TeeNode[]}
 */
export function teeNodes(body) {
	return (body?.crns ?? [])
		.filter((n) => n?.confidential_support === true && n?.system_usage?.active !== false)
		.map((n) => {
			const u = n.system_usage ?? {};
			const freeVcpus = Math.max(0, Math.floor((u.cpu?.count ?? 0) - (u.cpu?.load_average?.load1 ?? 0)));
			const memKiB = u.mem?.available_kB ?? 0;
			const diskKiB = u.disk?.available_kB ?? 0;
			return {
				hash: String(n.hash ?? ''),
				name: String(n.name ?? '').trim() || String(n.hash ?? '').slice(0, 8),
				score: Number(n.score ?? 0),
				freeVcpus,
				freeMemoryGiB: Math.floor(memKiB / 1024 ** 2),
				freeDiskGiB: Math.floor(diskKiB / 1024 ** 2),
				fits: freeVcpus >= PAPERLESS_VM.vcpus && memKiB >= PAPERLESS_VM.memoryKiB && diskKiB >= PAPERLESS_VM.diskKiB
			};
		})
		.sort((a, b) => b.score - a.score);
}

/** @param {{ fetch?: typeof fetch, url?: string }} [options] */
export async function loadTeeNodes({ fetch: fetchImpl = fetch, url = CRN_LIST } = {}) {
	const res = await fetchImpl(url, { cache: 'no-store' });
	if (!res.ok) throw new Error(`CRN list ${res.status}`);
	return teeNodes(await res.json());
}
