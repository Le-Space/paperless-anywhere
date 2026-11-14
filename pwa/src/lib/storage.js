// How much of the included storage the documents take (pilot: 8 GB per
// package; the landing page and the terms say the same). The backups have
// their own room and are part of every package offered now (terms version 3);
// an account on an older package has them as a line of its subscription or
// pays months from the balance. A running VM reports
// its documents' size on its private status page; a stopped one is known by
// its last backup's size.

import { format, tr } from './i18n/index.js';

/** Included in every package during the pilot, in bytes (decimal GB). */
export const STORAGE_INCLUDED_BYTES = 8e9;
/** From this share on the app says the storage is getting full. */
export const STORAGE_NEAR = 0.8;

const gb = (/** @type {number} */ bytes) => format.number(bytes / 1e9, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/**
 * @param {number | null | undefined} bytes the documents' size
 * @param {'running' | 'backup'} source measured in the VM, or the last backup's size
 * @returns {{ share: number, level: 'ok' | 'near' | 'over', text: string, hint: string } | null}
 */
export function storageView(bytes, source) {
	if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes < 0) return null;
	const share = bytes / STORAGE_INCLUDED_BYTES;
	const level = share >= 1 ? 'over' : share >= STORAGE_NEAR ? 'near' : 'ok';
	const s = tr().backup.storage;
	const text = s.used(gb(bytes), gb(STORAGE_INCLUDED_BYTES));
	const hint =
		level === 'over'
			? s.over
			: level === 'near'
				? s.near(gb(STORAGE_INCLUDED_BYTES - bytes))
				: source === 'backup'
					? s.asOfBackup
					: s.free(gb(STORAGE_INCLUDED_BYTES - bytes));
	return { share: Math.min(1, share), level, text, hint };
}
