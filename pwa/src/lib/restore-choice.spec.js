import { describe, expect, it } from 'vitest';
import { choiceAfterReading, choiceHolds } from './restore-choice.js';

const list = [{ pieceCid: 'newest' }, { pieceCid: 'older' }, { pieceCid: 'foreign' }];
const vault = ['newest', 'older'];
const fallback = () => 'own';

describe('the choice of what to start with, when the list is read again', () => {
	it('keeps a backup the person picked, as long as it is in the list', () => {
		expect(choiceAfterReading({ byPerson: true, choice: 'pick', pickedCid: 'older' }, list, vault, fallback)).toBe('pick');
	});
	it('falls back to the default when the picked backup is gone from the list', () => {
		expect(choiceAfterReading({ byPerson: true, choice: 'pick', pickedCid: 'removed' }, list, vault, fallback)).toBe('own');
		expect(choiceHolds({ choice: 'pick', pickedCid: '' }, list, vault)).toBe(false);
	});
	it('takes the default as long as the person chose nothing, whatever the card had', () => {
		expect(choiceAfterReading({ byPerson: false, choice: 'pick', pickedCid: 'older' }, list, vault, fallback)).toBe('own');
		expect(choiceAfterReading({ byPerson: false, choice: 'empty' }, list, vault, fallback)).toBe('own');
	});
	it('keeps "empty" when the person chose it, also while backups exist', () => {
		expect(choiceAfterReading({ byPerson: true, choice: 'empty' }, list, vault, fallback)).toBe('empty');
	});
	it('keeps "own" and "latest" only while a backup with the vault’s mark is listed, "any" only while one without is', () => {
		expect(choiceHolds({ choice: 'own' }, list, vault)).toBe(true);
		expect(choiceHolds({ choice: 'latest' }, list, vault)).toBe(true);
		expect(choiceHolds({ choice: 'own' }, list, [])).toBe(false);
		expect(choiceHolds({ choice: 'any' }, list, vault)).toBe(true);
		expect(choiceHolds({ choice: 'any' }, [{ pieceCid: 'newest' }], vault)).toBe(false);
		expect(choiceAfterReading({ byPerson: true, choice: 'own' }, list, [], () => 'any')).toBe('any');
	});
	it('takes nothing unknown for a choice', () => {
		expect(choiceHolds({ choice: 'something' }, list, vault)).toBe(false);
	});
});
