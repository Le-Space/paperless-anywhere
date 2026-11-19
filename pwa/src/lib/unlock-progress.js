// The attestation library (@le-space/attest-wasm `unlockInstance`) reports its
// progress as English sentences. The start shows the app's own words for each
// of its phases instead; the library's text, with the browser's error in it,
// goes only to the diagnosis (`noteWait`), where support reads it.
import { noteWait } from './diagnosis.js';
import { tr } from './i18n/index.js';

/**
 * The line the start shows for one progress report of `unlockInstance`.
 * @param {{ phase?: string, detail?: string }} p
 */
export function unlockDetail({ phase, detail }) {
	const x = tr().life.progress.unlockPhase;
	if (phase === 'attest') {
		const m = /\((\d+)\/(\d+)\)/.exec(String(detail ?? ''));
		return m ? x.attestTry(Number(m[1]), Number(m[2])) : x.attest;
	}
	if (phase === 'wait') {
		noteWait(String(detail ?? ''));
		return x.wait;
	}
	if (phase === 'unlock') return x.unlock;
	return tr().life.progress.unlock;
}
