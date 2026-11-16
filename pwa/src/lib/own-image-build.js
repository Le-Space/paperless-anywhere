// "Mein Image bauen" for one vault, as the setup and a first start both need
// it: with a Le Space package the Credits balance pays (the person sees the
// price, or that a voucher includes it, and agrees); otherwise the app's
// address. The build is noted in the profile while its builder runs, so a
// closed window leaves nothing behind (own-image.js, forgetLeftBuilder).
import { privateKeyToAccount } from 'viem/accounts';
import { IMAGE_BUILD_TYPES, imageBuild, imageBuildDone, vmAuthorize } from './credits.js';
import { format, tr } from './i18n/index.js';
import { alephPrivateKey } from './keys/derive.js';
import { attestRelaysFor } from './relays.js';
import { ALEPH_API } from './aleph.js';
import { keepPrevious } from './old-image.js';
import { BUILDER, BuilderError, buildOnOwnBuilder, buildOwnImage, buildPaidByPackage, builderOpener, forgetBuilder } from './own-image.js';

/**
 * Build this vault's own image. Resolves to the profile fields of the new
 * image (`{ rootfsItemHash, luksPassphrase, luksFor, ownImage }`), or to null
 * when the person declined the price. The caller saves them.
 * @param {{
 *   master: Uint8Array,
 *   profile: Record<string, any>,
 *   packagePays: boolean,
 *   confirm: (question: string) => boolean | Promise<boolean>,
 *   save: (patch: Record<string, any>) => Promise<any>,
 *   onProgress?: (p: { step: string, detail?: string }) => void,
 *   builder?: any,
 *   deps?: { read?: (hash: string) => Promise<any>, post?: (message: any) => Promise<void>, relays?: typeof attestRelaysFor, authorize?: typeof vmAuthorize, build?: typeof imageBuild, done?: typeof imageBuildDone, paid?: typeof buildPaidByPackage, own?: typeof buildOnOwnBuilder, running?: typeof buildOwnImage, opener?: typeof builderOpener }
 * }} a
 * @returns {Promise<Record<string, any> | null>}
 */
export async function buildImageForVault(a) {
	const built = await buildOnce(a);
	// A rebuild replaces an own image: the old one stays as the way back until
	// the new one has started well, and is forgotten only then (old-image.js).
	return built ? keepPrevious(a.profile ?? {}, built) : built;
}

/**
 * Forget an own image's STORE in the name of whoever owns it: the app's
 * address, or the Le Space sub-account a package paid it from (the app's
 * key may send FORGET for it). Anything else is left alone.
 * @param {import('viem').LocalAccount} app @param {string} store
 * @param {{ read?: (hash: string) => Promise<any>, post?: (message: any) => Promise<void> }} [deps]
 * @returns {Promise<boolean>} true when forgotten
 */
export async function forgetOldImage(app, store, deps = {}) {
	const read = deps.read ?? (async (hash) => (await fetch(`${ALEPH_API}/api/v0/messages/${hash}`, { cache: 'no-store' })).json());
	const m = await read(store);
	if (m?.status !== 'processed' || m?.message?.type !== 'STORE') return false;
	const owner = String(m.message.content?.address ?? '');
	// Only what this vault's key sent: its own STORE, or one it sent for the sub-account.
	if (String(m.message.sender ?? '').toLowerCase() !== app.address.toLowerCase() || !/^0x[0-9a-fA-F]{40}$/.test(owner)) return false;
	return forgetBuilder(app, store, { payer: owner, ...(deps.post ? { post: deps.post } : {}), sleep: async () => {} });
}

async function buildOnce({ master, profile, packagePays, confirm, save, onProgress = () => {}, builder = BUILDER, deps = {} }) {
	if (!builder) throw new BuilderError(tr().ownImage.error.noBuilder);
	const { relays = attestRelaysFor, authorize = vmAuthorize, build = imageBuild, done = imageBuildDone, paid = buildPaidByPackage, own = buildOnOwnBuilder, running = buildOwnImage, opener: open = builderOpener } = deps;
	// A relay first: without one the builder cannot be reached, and a builder
	// started (and paid, or a voucher's build used) for nothing helps nobody.
	await relays(profile);
	const common = { master, app: privateKeyToAccount(alephPrivateKey(master)), onProgress };
	const opener = (/** @type {any} */ b) => open(b, profile);
	// A builder fixed by its V-PROGRAM content is started for this build and
	// forgotten afterwards; the profile notes it meanwhile.
	const onForgotten = () => save({ ownBuilder: null });
	if (!('program' in builder)) return running({ ...common, builder, open: opener(builder) });
	if (!packagePays) return own({ ...common, builder, opener, onStarted: (vprogram) => save({ ownBuilder: { vprogram, at: new Date().toISOString() } }), onForgotten });

	// The package pays: the app key may send the builder and the STORE for the
	// sub-account (authorize again picks up new types), and the person sees
	// the price, or that the voucher includes it, and agrees first.
	const granted = await authorize(master);
	if (!granted.types || !IMAGE_BUILD_TYPES.every((type) => granted.types?.includes(type))) throw new Error(tr().ownImage.choice.serviceOld);
	const version = builder.plain?.sha256 ?? null;
	const quote = await build(master, { quote: true, version });
	const question = quote.included ? tr().ownImage.choice.confirmIncluded : tr().ownImage.choice.confirmPrice(format.euro(quote.chargedCredits ?? 0));
	if (!(await confirm(question))) return null;
	return paid({
		...common,
		builder,
		opener,
		charge: () => build(master, { version }),
		done: (d) => done(master, d),
		onStarted: (vprogram, p) => save({ ownBuilder: { vprogram, payer: p?.payer ?? null, buildId: p?.buildId ?? null, at: new Date().toISOString() } }),
		onForgotten,
		// The end could not be reported: kept, with how it went, for the next opening.
		onUndelivered: ({ buildId, program, ok, payer }) => save({ ownBuilder: { vprogram: program, payer: payer ?? null, buildId, ok, at: new Date().toISOString() } }),
		owner: granted.owner
	});
}
