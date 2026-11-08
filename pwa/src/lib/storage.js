// How much of the included storage the documents take (pilot: 8 GB per
// package; the landing page and the terms say the same). A running VM reports
// its documents' size on its private status page; a stopped one is known by
// its last backup's size.

/** Included in every package during the pilot, in bytes (decimal GB). */
export const STORAGE_INCLUDED_BYTES = 8e9;
/** From this share on the app says the storage is getting full. */
export const STORAGE_NEAR = 0.8;

const gb = (/** @type {number} */ bytes) => (bytes / 1e9).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/**
 * @param {number | null | undefined} bytes the documents' size
 * @param {'running' | 'backup'} source measured in the VM, or the last backup's size
 * @returns {{ share: number, level: 'ok' | 'near' | 'over', text: string, hint: string } | null}
 */
export function storageView(bytes, source) {
	if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes < 0) return null;
	const share = bytes / STORAGE_INCLUDED_BYTES;
	const level = share >= 1 ? 'over' : share >= STORAGE_NEAR ? 'near' : 'ok';
	const text = `${gb(bytes)} GB von ${gb(STORAGE_INCLUDED_BYTES)} GB`;
	const hint =
		level === 'over'
			? 'Mehr als im Paket enthalten. Bitte alte Dokumente löschen oder uns schreiben; Sicherungen könnten sonst scheitern.'
			: level === 'near'
				? `Noch ${gb(STORAGE_INCLUDED_BYTES - bytes)} GB frei. Wird es knapp, scheitern zuerst die Sicherungen.`
				: source === 'backup'
					? 'Stand der letzten Sicherung.'
					: `Noch ${gb(STORAGE_INCLUDED_BYTES - bytes)} GB frei.`;
	return { share: Math.min(1, share), level, text, hint };
}
