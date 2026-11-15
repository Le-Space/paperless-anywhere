// "Mein Image bauen" from anywhere in the app goes through the one full-screen
// build (FirstStart.svelte, in the Paperless card): the setup asks here, the
// card answers. So the build looks the same whichever button started it.
// Resolves to true when the image was built, false when the person declined
// the price; rejects with the reason when it failed or cannot run now.
import { tr } from './i18n/index.js';

/** @type {null | (() => Promise<boolean>)} */
let handler = null;

/** The Paperless card registers the build; returns the function that unregisters it. @param {() => Promise<boolean>} fn */
export function onImageBuild(fn) {
	handler = fn;
	return () => {
		if (handler === fn) handler = null;
	};
}

/** Build this vault's own image in the full screen, without a start after it. */
export function requestImageBuild() {
	if (!handler) return Promise.reject(new Error(tr().first.noCard));
	return handler();
}
