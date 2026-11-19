// A backup with a full part (1 GB before encryption) does not fit an image
// built before 2026-11-16 evening: the start says so before a VM is paid for.
import { describe, expect, it, vi } from 'vitest';

const sent = vi.hoisted(() => ({ instance: vi.fn(async () => 'ab'.repeat(32)) }));
vi.mock('./attest-wasm-load.js', () => ({ loadAttestWasm: async () => ({}) }));
vi.mock('./own-image-check.js', async (orig) => ({ ...(await orig()), ownImageVerified: () => true }));
vi.mock('./vm.js', async (orig) => ({ ...(await orig()), sendInstance: (...a) => sent.instance(...a) }));

const { FULL_PART_IMAGES, INCREMENTAL_IMAGES, OLD_PART_LIMIT, restoreFitsImage } = await import('./backups.js');
const { startPaperless } = await import('./lifecycle.js');
const { BUILDER } = await import('./own-image.js');
const { ownImageVersions } = await import('./own-image-versions.js');

// The image a vault builds now: the BUILDER on main, not an entry of the list.
const newImage = { ownImage: { plainSha256: BUILDER.plain.sha256 } };
const oldImage = { ownImage: { plainSha256: 'f'.repeat(64) } };
const twoParts = (first) => ({ pieceCid: 'baga-whole', size: first + 83e6, parts: [{ pieceCid: 'baga-1', size: first }, { pieceCid: 'baga-2', size: 83e6 }], copies: [] });

describe('a backup part and the image that restores it', () => {
	it('the image of the BUILDER on main, and every one built since 2026-11-17, takes a full part', () => {
		// 2026-11-19: the list still named only the image before, so the newest one refused every backup with a full part.
		expect(FULL_PART_IMAGES).toContain(BUILDER.plain.sha256);
		expect(INCREMENTAL_IMAGES).toContain(BUILDER.plain.sha256);
		for (const v of ownImageVersions().versions.filter((x) => x.since >= '2026-11-17')) expect(FULL_PART_IMAGES).toContain(v.plainSha256);
	});
	it('a full part needs an image from the list', () => {
		expect(restoreFitsImage(oldImage, twoParts(1_000_420_000))).toBe(false);
		expect(restoreFitsImage(newImage, twoParts(1_000_420_000))).toBe(true);
		expect(restoreFitsImage({}, twoParts(1_000_420_000))).toBe(false);
	});
	it('smaller parts, one piece, or no sizes fit any image', () => {
		expect(restoreFitsImage(oldImage, twoParts(OLD_PART_LIMIT))).toBe(true);
		expect(restoreFitsImage(oldImage, { pieceCid: 'baga', copies: [] })).toBe(true);
		expect(restoreFitsImage(oldImage, { pieceCid: 'baga', parts: [{ pieceCid: 'a' }, { pieceCid: 'b' }], copies: [] })).toBe(true);
		expect(restoreFitsImage(oldImage, null)).toBe(true);
	});
	it('the start refuses it on an older image before any VM is requested', async () => {
		const profile = { ...oldImage, rootfsItemHash: 'r'.repeat(64), luksPassphrase: 'p', luksFor: 'r'.repeat(64), crnHash: 'c'.repeat(64), role: 'test', network: 'calibration', appPays: true, ageIdentity: 'made-up', restoreEntry: twoParts(1_000_420_000) };
		await expect(startPaperless(new Uint8Array(32).fill(7), profile, () => {})).rejects.toThrow('über 1 GB');
		expect(sent.instance).not.toHaveBeenCalled();
	});
});
