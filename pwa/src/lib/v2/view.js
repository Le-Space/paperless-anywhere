// The two views of the v0.2 interface: "Standard" shows what everyday use
// needs; "Technisch" shows the same, in the same place, and adds every detail
// and control. One store holds the choice; a component reads `$technical` and
// renders what it adds (after simple-todo's technical-view.js).
//
// Remembered per device in localStorage, where nothing secret is kept: the
// value is 'standard' or 'technical'. Someone who chose "Erweitert" in v0.1
// starts in "Technisch". With storage blocked the choice holds for this visit.
import { derived, writable } from 'svelte/store';

/** @typedef {'standard' | 'technical'} View */
export const VIEWS = /** @type {const} */ (['standard', 'technical']);
export const VIEW_KEY = 'paperless-anywhere.view';
// v0.1's tab choice ('simple' | 'advanced'); read once, never written here.
const TAB_KEY = 'paperless-anywhere.tab';

/** The view to start with. @param {Pick<Storage, 'getItem'> | null | undefined} [storage] @returns {View} */
export function savedView(storage = globalThis.localStorage) {
	try {
		const own = storage?.getItem(VIEW_KEY);
		if (own === 'standard' || own === 'technical') return own;
		return storage?.getItem(TAB_KEY) === 'advanced' ? 'technical' : 'standard';
	} catch {
		return 'standard';
	}
}

/** @param {Pick<Storage, 'getItem' | 'setItem'> | null | undefined} [storage] injectable for tests */
export function createView(storage = globalThis.localStorage) {
	/** @type {import('svelte/store').Writable<View>} */
	const view = writable(savedView(storage));
	/** Choose a view: applied at once, remembered in this browser. @param {View} next */
	const setView = (next) => {
		if (!VIEWS.includes(next)) return;
		try {
			storage?.setItem(VIEW_KEY, next);
		} catch {
			/* only for this visit */
		}
		view.set(next);
	};
	return { view, setView, technical: derived(view, (v) => v === 'technical') };
}

export const { view, setView, technical } = createView();
