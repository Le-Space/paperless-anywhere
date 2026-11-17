// "Standard" keeps the parts of v0.1 it reuses (the panel of lights, the
// first-start journey, "Jetzt sichern") and gives them plain words: a part
// takes its texts as a value, and this lays the plain ones over them. What
// the plain catalogue does not name stays as it is, so nothing goes missing.

/**
 * `over` laid over `base`, key by key, into a new object; arrays, functions
 * and strings are replaced whole. Neither argument is changed.
 * @template T
 * @param {T} base
 * @param {any} over
 * @returns {T}
 */
export function overlay(base, over) {
	const plain = (/** @type {any} */ v) => v !== null && typeof v === 'object' && !Array.isArray(v);
	if (!plain(base) || !plain(over)) return over === undefined ? base : over;
	const out = /** @type {any} */ ({ .../** @type {any} */ (base) });
	for (const key of Object.keys(over)) out[key] = overlay(/** @type {any} */ (base)[key], over[key]);
	return out;
}
