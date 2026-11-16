import { describe, expect, it } from 'vitest';
import { newMasterSecret, imagePassphrase } from './keys/derive.js';
import { ownImagePatch, ownImageVerified, runsOwnImage } from './own-image-check.js';
import { buildsImageFirst } from './lifecycle.js';

const master = newMasterSecret();
const plain = 'ef'.repeat(32);
const store = 'aa'.repeat(32);
const own = { rootfsItemHash: store, luksFor: store, luksPassphrase: imagePassphrase(master, plain), ownImage: { plainSha256: plain, rootfsItemHash: store } };
const publicImage = { rootfsItemHash: 'bb'.repeat(32), luksFor: 'bb'.repeat(32), luksPassphrase: 'the version passphrase' };

describe('which image a profile starts from', () => {
	it('knows the own image by its record and by the passphrase from the vault', () => {
		expect(runsOwnImage(own)).toBe(true);
		expect(ownImageVerified(master, own)).toBe(true);
	});
	it('does not take the public image for an own one, even with an own image built earlier', () => {
		const back = { ...publicImage, ownImage: own.ownImage };
		expect(runsOwnImage(back)).toBe(false);
		expect(ownImageVerified(master, back)).toBe(false);
	});
	it('checks the passphrase against this vault, not the record alone', () => {
		expect(ownImageVerified(newMasterSecret(), own)).toBe(false);
		expect(ownImageVerified(master, { ...own, luksPassphrase: 'something else' })).toBe(false);
	});
	it('completes an older own image record once the passphrase proves it', () => {
		const older = { ...own, ownImage: { plainSha256: plain } };
		expect(runsOwnImage(older)).toBe(false);
		expect(ownImagePatch(master, older)).toEqual({ ownImage: { plainSha256: plain, rootfsItemHash: store } });
		expect(ownImagePatch(master, { ...publicImage, ownImage: { plainSha256: plain } })).toBeNull();
	});
	it('builds the own image at the next start of a production instance still on the public image', () => {
		const builder = { plain: { sha256: plain } };
		expect(buildsImageFirst({ ...publicImage, role: 'primary' }, builder)).toBe(true);
		expect(buildsImageFirst({ ...own, role: 'primary' }, builder)).toBe(false);
		expect(buildsImageFirst({ ...publicImage, role: 'test' }, builder)).toBe(false);
	});
});
