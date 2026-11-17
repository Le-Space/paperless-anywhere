// What a start begins with ("latest", "own", "any", a picked backup, or
// "empty"), when the list of backups is read again. The card reads the list
// often (a saved setting, a booked package, accepted places); a choice the
// person made must survive that, as long as it still names a backup in the
// list. Without a choice of the person, the card's default applies.
import { splitOwn } from './backups.js';

/** @typedef {{ choice: string, pickedCid?: string }} Choice */

/**
 * Whether a choice still names something in this list.
 * @param {Choice} c @param {{ pieceCid: string }[]} list @param {string[]} [vaultBackups] the piece CIDs that carry the vault's mark
 */
export function choiceHolds({ choice, pickedCid = '' }, list, vaultBackups = []) {
	const { own, other } = splitOwn(list, vaultBackups);
	if (choice === 'pick') return Boolean(pickedCid) && list.some((b) => b.pieceCid === pickedCid);
	if (choice === 'latest' || choice === 'own') return own.length > 0;
	if (choice === 'any') return other.length > 0;
	return choice === 'empty';
}

/**
 * The choice after the list was read: the person's own while it holds, else the default for this list.
 * @param {Choice & { byPerson: boolean }} c @param {{ pieceCid: string }[]} list @param {string[]} vaultBackups @param {(list: any[]) => string} fallback
 */
export const choiceAfterReading = (c, list, vaultBackups, fallback) => (c.byPerson && choiceHolds(c, list, vaultBackups) ? c.choice : fallback(list));
