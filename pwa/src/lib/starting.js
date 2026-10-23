// The instance a start in this tab is bringing up, until the start ends: the
// VM list counts it as known, not as a leftover of an aborted start.
import { writable } from 'svelte/store';

/** @type {import('svelte/store').Writable<string>} */
export const startingInstance = writable('');
