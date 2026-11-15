// One purchase at a time: which one's declaration on withdrawal is on screen.
// A purchase is chosen first (a package, an amount, the backup year or line);
// only then its declaration shows, right above "continue to payment". Choosing
// another purchase hides the first one's declaration and unticks it, so the
// screen never holds two and each box belongs visibly to its own purchase
// (le-space-credits, § 356 Abs. 4 and 5 BGB).
import { writable } from 'svelte/store';

/** @type {import('svelte/store').Writable<string>} '' or the purchase being prepared */
export const preparing = writable('');
