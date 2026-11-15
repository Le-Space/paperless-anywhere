// "Mein Image bauen" for one vault, as the setup and a first start both need
// it: with a Le Space package the Credits balance pays (the person sees the
// price, or that a voucher includes it, and agrees); otherwise the app's
// address. The build is noted in the profile while its builder runs, so a
// closed window leaves nothing behind (own-image.js, forgetLeftBuilder).
import { privateKeyToAccount } from 'viem/accounts';
import { IMAGE_BUILD_TYPES, imageBuild, imageBuildDone, vmAuthorize } from './credits.js';
import { format, tr } from './i18n/index.js';
import { alephPrivateKey } from './keys/derive.js';
import { BUILDER, BuilderError, buildOnOwnBuilder, buildOwnImage, buildPaidByPackage, builderOpener } from './own-image.js';

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
 *   deps?: { authorize?: typeof vmAuthorize, build?: typeof imageBuild, done?: typeof imageBuildDone, paid?: typeof buildPaidByPackage, own?: typeof buildOnOwnBuilder, running?: typeof buildOwnImage, opener?: typeof builderOpener }
 * }} a
 * @returns {Promise<Record<string, any> | null>}
 */
export async function buildImageForVault({ master, profile, packagePays, confirm, save, onProgress = () => {}, builder = BUILDER, deps = {} }) {
	if (!builder) throw new BuilderError(tr().ownImage.error.noBuilder);
	const { authorize = vmAuthorize, build = imageBuild, done = imageBuildDone, paid = buildPaidByPackage, own = buildOnOwnBuilder, running = buildOwnImage, opener: open = builderOpener } = deps;
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
	const quote = await build(master, { quote: true });
	const question = quote.included ? tr().ownImage.choice.confirmIncluded : tr().ownImage.choice.confirmPrice(format.euro(quote.chargedCredits ?? 0));
	if (!(await confirm(question))) return null;
	return paid({
		...common,
		builder,
		opener,
		charge: () => build(master),
		done: (d) => done(master, d),
		onStarted: (vprogram, p) => save({ ownBuilder: { vprogram, payer: p?.payer ?? null, buildId: p?.buildId ?? null, at: new Date().toISOString() } }),
		onForgotten
	});
}
